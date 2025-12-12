import React, { useState, useEffect } from 'react';
import {
  BarChart3, FileText, Truck, HardDrive, AlertCircle,
  Menu, X, ChevronLeft, ChevronRight, Camera
} from 'lucide-react';

// Import dei componenti admin esistenti
import AdminDashboard from './AdminDashboard';
import AdminInvoiceManager from './AdminInvoiceManager';
import AdminMovimentazioniManager from './AdminMovimentazioniManager';
import SegnalazioniManager from '../SegnalazioniManager';  // ✅ AGGIUNGI QUESTA
import TxtFilesManager from '../TxtFilesManager';
import DDTScanner from './DDTScanner';

const AdminSidebarLayout = ({ 
  user, 
  activeTab, 
  setActiveTab
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

  // ✅ SOLO MENU ADMIN - Rimossi menu items utente
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
    id: 'admin-segnalazioni', 
    label: 'Segnalazioni', 
    icon: AlertCircle,
    description: 'Gestione segnalazioni errori DDT'
  },
    {
      id: 'txt-files',
      label: 'File TXT',
      icon: HardDrive,
      description: 'Archivio file di conferma'
    },
    {
      id: 'ddt-scanner',
      label: 'Scanner DDT',
      icon: Camera,
      description: 'Scansiona DDT con OCR'
    }
  ];

  const MenuItem = ({ item }) => {
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
        title={sidebarCollapsed ? item.label : ''}
      >
        <div className="relative">
          <Icon className="h-5 w-5 flex-shrink-0" />
        </div>
        
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-semibold truncate">{item.label}</span>
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

  // Render del contenuto principale basato sul tab attivo
  const renderContent = () => {
    switch(activeTab) {
      case 'admin-dashboard':
        return <AdminDashboard user={user} />;
      case 'admin-invoices':
        return <AdminInvoiceManager user={user} />;
      case 'admin-movimentazioni':
        return <AdminMovimentazioniManager user={user} />;
        case 'admin-segnalazioni':
      return <SegnalazioniManager user={user} />;
      case 'txt-files':
        return <TxtFilesManager user={user} />;
      case 'ddt-scanner':
        return <DDTScanner user={user} />;
      default:
        return <AdminDashboard user={user} />; // Default a dashboard
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
          
          {/* ✅ SOLO Admin Panel Section */}
          <div>
            {!sidebarCollapsed && (
              <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center space-x-2 text-fradiavolo-red">
                <div className="w-2 h-2 rounded-full bg-fradiavolo-red"></div>
                <span>Pannello Amministratore</span>
              </div>
            )}
            <div className="space-y-2 mt-3">
              {adminMenuItems.map((item) => (
                <MenuItem key={item.id} item={item} />
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
        <div className="h-full p-6 overflow-y-auto bg-gray-50">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default AdminSidebarLayout;
