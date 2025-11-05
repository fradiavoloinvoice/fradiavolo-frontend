import React, { useState, useEffect } from 'react';
import { 
  BarChart3, FileText, Truck, HardDrive, 
  Package, CheckCircle, Menu, X, ChevronLeft, ChevronRight, Store 
} from 'lucide-react';

// Import dei componenti admin esistenti
import AdminDashboard from './AdminDashboard';
import AdminInvoiceManager from './AdminInvoiceManager';
import AdminMovimentazioniManager from './AdminMovimentazioniManager';
import TxtFilesManager from '../TxtFilesManager';
import Movimentazione from '../Movimentazione';

const AdminSidebarLayout = ({ 
  user, 
  activeTab, 
  setActiveTab, 
  pendingCount = 0, 
  deliveredCount = 0,
  children 
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Chiudi sidebar mobile quando cambia tab
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [activeTab]);

  // Chiudi sidebar mobile con ESC
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const adminMenuItems = [
    { 
      id: 'admin-dashboard', 
      label: 'Dashboard', 
      icon: BarChart3,
      description: 'Panoramica generale del sistema'
    },
    { 
      id: 'admin-invoices', 
      label: 'Fatture Globali', 
      icon: FileText,
      description: 'Gestione fatture di tutti i punti vendita'
    },
    { 
      id: 'admin-movimentazioni', 
      label: 'Movimenti Globali', 
      icon: Truck,
      description: 'Movimentazioni tra tutti i negozi'
    },
    { 
      id: 'txt-files', 
      label: 'File TXT', 
      icon: HardDrive,
      description: 'Archivio file di conferma'
    }
  ];

  const userMenuItems = [
    { 
      id: 'pending', 
      label: 'Da Confermare', 
      icon: Package, 
      badge: pendingCount,
      description: 'Fatture in attesa di conferma'
    },
    { 
      id: 'delivered', 
      label: 'Confermate', 
      icon: CheckCircle, 
      badge: deliveredCount,
      description: 'Storico consegne completate'
    },
    { 
      id: 'movimentazione', 
      label: 'Movimentazione', 
      icon: Truck,
      description: 'Trasferimenti merce tra negozi'
    }
  ];

  const MenuItem = ({ item, section }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    
    return (
      <button
        onClick={() => setActiveTab(item.id)}
        className={`w-full text-left p-3 rounded-xl transition-all duration-200 group flex items-center space-x-3 ${
          isActive
            ? 'bg-fradiavolo-red text-white shadow-fradiavolo transform scale-105'
            : 'text-fradiavolo-charcoal hover:bg-fradiavolo-cream hover:text-fradiavolo-red'
        } ${sidebarCollapsed ? 'justify-center' : ''}`}
        title={sidebarCollapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : ''}
      >
        <div className="relative">
          <Icon className="h-5 w-5 flex-shrink-0" />
          {item.badge > 0 && (
            <span className={`absolute -top-2 -right-2 h-5 w-5 text-xs font-bold rounded-full flex items-center justify-center ${
              section === 'admin' 
                ? 'bg-fradiavolo-red/20 text-fradiavolo-red border border-fradiavolo-red/30' 
                : 'bg-fradiavolo-green/20 text-fradiavolo-green border border-fradiavolo-green/30'
            } ${isActive ? 'bg-white/20 text-white border-white/30' : ''}`}>
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
        </div>
        
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold truncate">{item.label}</span>
              {item.badge > 0 && (
                <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                  section === 'admin' 
                    ? 'bg-fradiavolo-red/10 text-fradiavolo-red' 
                    : 'bg-fradiavolo-green/10 text-fradiavolo-green'
                } ${isActive ? 'bg-white/20 text-white' : ''}`}>
                  {item.badge}
                </span>
              )}
            </div>
            <p className={`text-xs mt-1 truncate ${
              isActive ? 'text-white/80' : 'text-fradiavolo-charcoal-light'
            }`}>
              {item.description}
            </p>
          </div>
        )}
      </button>
    );
  };

  const SectionTitle = ({ title, isAdmin }) => (
    !sidebarCollapsed && (
      <div className={`px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center space-x-2 ${
        isAdmin ? 'text-fradiavolo-red' : 'text-fradiavolo-green'
      }`}>
        <div className={`w-2 h-2 rounded-full ${
          isAdmin ? 'bg-fradiavolo-red' : 'bg-fradiavolo-green'
        }`}></div>
        <span>{title}</span>
      </div>
    )
  );

  // Render del contenuto principale basato sul tab attivo
  const renderContent = () => {
    switch(activeTab) {
      case 'admin-dashboard':
        return <AdminDashboard user={user} />;
      case 'admin-invoices':
        return <AdminInvoiceManager user={user} />;
      case 'admin-movimentazioni':
        return <AdminMovimentazioniManager user={user} />;
      case 'txt-files':
        return <TxtFilesManager user={user} />;
      case 'movimentazione':
        return <Movimentazione user={user} />;
      default:
        return children; // Per 'pending' e 'delivered' usa il contenuto passato come children
    }
  };

  return (
    <div className="flex h-full">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-fradiavolo-red text-white rounded-xl shadow-fradiavolo"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 
        fixed md:static 
        top-0 left-0 
        h-full 
        ${sidebarCollapsed ? 'w-16' : 'w-64'} 
        bg-white 
        border-r border-fradiavolo-cream-dark 
        transition-all duration-300 
        z-40
        flex flex-col
        shadow-fradiavolo-lg md:shadow-none
      `}>
        
        {/* Sidebar Header */}
        <div className={`p-4 border-b border-fradiavolo-cream-dark flex items-center justify-between ${
          sidebarCollapsed ? 'px-2' : ''
        }`}>
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-fradiavolo-red rounded-lg">
                <div className="h-5 w-5 text-white text-center text-sm">🍕</div>
              </div>
              <div>
                <h2 className="font-bold text-fradiavolo-charcoal text-sm">Admin Panel</h2>
                <p className="text-xs text-fradiavolo-charcoal-light">{user.puntoVendita}</p>
              </div>
            </div>
          )}
          
          {/* Desktop Collapse Button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex p-1 hover:bg-fradiavolo-cream rounded-lg transition-colors"
            title={sidebarCollapsed ? 'Espandi sidebar' : 'Comprimi sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4 text-fradiavolo-charcoal" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-fradiavolo-charcoal" />
            )}
          </button>
          
          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-fradiavolo-cream rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-fradiavolo-charcoal" />
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          
          {/* Admin Panel Section */}
          <div>
            <SectionTitle title="Admin Panel" isAdmin={true} />
            <div className="space-y-2 mt-3">
              {adminMenuItems.map((item) => (
                <MenuItem key={item.id} item={item} section="admin" />
              ))}
            </div>
          </div>

          {/* User Operations Section */}
          <div>
            <SectionTitle title="Operazioni" isAdmin={false} />
            <div className="space-y-2 mt-3">
              {userMenuItems.map((item) => (
                <MenuItem key={item.id} item={item} section="user" />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className={`p-3 border-t border-fradiavolo-cream-dark ${
          sidebarCollapsed ? 'text-center' : ''
        }`}>
          <div className={`text-xs text-fradiavolo-charcoal-light ${
            sidebarCollapsed ? 'hidden' : ''
          }`}>
            <p className="font-semibold text-fradiavolo-red">Modalità Admin</p>
            <p>Accesso completo al sistema</p>
          </div>
          {sidebarCollapsed && (
            <div className="w-2 h-2 bg-fradiavolo-red rounded-full mx-auto" title="Admin Mode"></div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        <div className="h-full p-6 overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AdminSidebarLayout;