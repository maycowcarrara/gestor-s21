import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarCheck, FileText, Settings,
  RefreshCw, LogOut, Printer, MoreHorizontal, Download, Share, X
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Importação das Páginas
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NovoPublicador from './pages/Publicadores/NovoPublicador';
import ListaPublicadores from './pages/Publicadores/ListaPublicadores';
import DetalhesPublicador from './pages/Publicadores/DetalhesPublicador';
import ControleAssistencia from './pages/Reunioes/ControleAssistencia';
import VisaoGeralRelatorios from './pages/Relatorios/VisaoGeralRelatorios';
import ImpressaoLote from './pages/Relatorios/ImpressaoLote';
import Configuracoes from './pages/Configuracoes/Configuracoes';

// --- 1. PWA CONTEXT (MANTIDO) ---
const PWAContext = createContext();

export const PWAProvider = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/.test(navigator.userAgent));
    const checkStandalone = () => {
      const isApp = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
      setIsStandalone(isApp);
    };
    checkStandalone();
    window.matchMedia('(display-mode: standalone)').addEventListener('change', checkStandalone);
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      toast("Instalação iniciada...", { icon: '📱' });
    }
  };

  return (
    <PWAContext.Provider value={{ deferredPrompt, isIOS, isStandalone, installPWA }}>
      {children}
    </PWAContext.Provider>
  );
};

const usePWA = () => useContext(PWAContext);

// --- 2. COMPONENTES DE ROTA ---

// Rota Privada (Qualquer usuário logado e permitido pode acessar)
const PrivateRoute = ({ children }) => {
  const { user, isPermitted, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100">Carregando...</div>;
  if (!user || !isPermitted) return <Navigate to="/login" />;
  return children;
};

// Rota de Admin (Apenas Coord/Secretário acessa - Proteção de URL)
const AdminRoute = ({ children }) => {
  const { user, isPermitted, isAdmin, loading } = useAuth();
  if (loading) return null;

  if (!user || !isPermitted) return <Navigate to="/login" />;

  if (!isAdmin) {
    // Se tentar acessar rota proibida, volta pro dashboard
    return <Navigate to="/" replace />;
  }

  return children;
};

const NavLink = ({ to, icon: Icon, label, onClick }) => {
  const location = useLocation();
  if (onClick) {
    return (
      <button onClick={onClick} className="flex items-center gap-3 p-3 w-full text-left rounded transition-colors duration-200 hover:bg-slate-700 text-slate-300 hover:text-white">
        <Icon size={20} /> <span className="font-medium">{label}</span>
      </button>
    );
  }
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to + '/'));
  return (
    <Link to={to} className={`flex items-center gap-3 p-3 rounded transition-colors duration-200 ${isActive ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-slate-700 text-slate-300 hover:text-white'}`}>
      <Icon size={20} /> <span className="font-medium">{label}</span>
    </Link>
  );
};

const MobileNavLink = ({ to, icon: Icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to + '/'));
  return (
    <Link to={to} className={`flex flex-col items-center text-[10px] gap-1 p-2 rounded transition-colors w-full ${isActive ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}>
      <Icon size={22} /> <span className="font-medium">{label}</span>
    </Link>
  );
};

// --- 3. LAYOUT DO SISTEMA ---

const LayoutSistema = ({ children }) => {
  const { logout, user, isAdmin } = useAuth(); // Pegamos isAdmin aqui
  const { deferredPrompt, isIOS, isStandalone, installPWA } = usePWA();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'Dev';

  const showInstallButton = !isStandalone && (!!deferredPrompt || isIOS);

  const handleInstallClick = () => {
    setMobileMenuOpen(false);
    if (isIOS) setShowIOSInstructions(true);
    else if (deferredPrompt) installPWA();
    else toast("App já instalado ou navegador não suportado.", { icon: '⚠️' });
  };

  const verificarAtualizacao = () => {
    if (window.confirm("Recarregar sistema para verificar atualizações?")) window.location.reload(true);
  };

  return (
    <div className="flex h-screen w-screen bg-gray-100 overflow-hidden">

      {/* MENU LATERAL (DESKTOP) */}
      <aside className="hidden md:flex w-64 bg-slate-800 text-white flex-col shadow-xl z-20 shrink-0">
        <div className="p-6 text-center font-bold text-xl border-b border-slate-700 tracking-wide">S-21 Digital</div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <NavLink to="/" icon={LayoutDashboard} label="Visão Geral" />
          <NavLink to="/publicadores" icon={Users} label="Publicadores" />
          <NavLink to="/relatorios" icon={FileText} label="Relatórios & S-1" />

          {/* Item visível apenas para Admin */}
          {isAdmin && <NavLink to="/reunioes" icon={CalendarCheck} label="Reuniões" />}

          <div className="pt-4 mt-4 border-t border-slate-700">
            <p className="px-3 text-xs font-bold text-slate-500 uppercase mb-2">Ferramentas</p>

            {/* Itens visíveis apenas para Admin */}
            {isAdmin && (
              <>
                <NavLink to="/impressao-lote" icon={Printer} label="Imprimir S-21" />
                <NavLink to="/configuracoes" icon={Settings} label="Configurações" />
              </>
            )}

            {showInstallButton && (
              <NavLink to="#" icon={Download} label="Instalar App" onClick={handleInstallClick} />
            )}
          </div>
        </nav>

        <div className="p-4 bg-slate-900 border-t border-slate-700 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-2">
            <img src={user?.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-600" />
            <div className="overflow-hidden">
              <p className="text-xs text-white font-bold truncate">{user?.displayName}</p>
              <p className="text-[10px] text-slate-400 truncate">{isAdmin ? 'Admin' : 'Publicador'}</p>
            </div>
          </div>
          <div className="flex justify-between items-center border-t border-slate-800 pt-2">
            <button onClick={verificarAtualizacao} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-white">
              <RefreshCw size={10} /> v{appVersion}
            </button>
            <button onClick={logout} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300">
              <LogOut size={10} /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* MENU MOBILE */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed bottom-20 right-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-50 md:hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div className="flex items-center gap-3 pb-4 mb-2 border-b border-gray-100">
              <img src={user?.photoURL} alt="User" className="w-10 h-10 rounded-full border border-gray-200" />
              <div><p className="text-sm font-bold text-gray-800 truncate">{user?.displayName}</p></div>
            </div>

            <div className="flex flex-col gap-1">
              {showInstallButton && (
                <button onClick={handleInstallClick} className="flex items-center gap-3 p-3 w-full text-left text-gray-700 hover:bg-blue-50 rounded-lg">
                  <Download size={18} /> <span className="font-medium">Instalar Aplicativo</span>
                </button>
              )}

              {/* Apenas Admin vê Configs e Impressão no Mobile */}
              {isAdmin && (
                <>
                  <Link to="/configuracoes" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                    <Settings size={18} /> <span className="font-medium">Configurações</span>
                  </Link>
                  <Link to="/impressao-lote" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 p-3 text-gray-700 hover:bg-gray-50 rounded-lg">
                    <Printer size={18} /> <span className="font-medium">Imprimir S-21</span>
                  </Link>
                </>
              )}

              <button onClick={() => { verificarAtualizacao(); setMobileMenuOpen(false); }} className="flex items-center gap-3 p-3 w-full text-left text-gray-700 hover:bg-gray-50 rounded-lg">
                <RefreshCw size={18} className="text-blue-500" />
                <div className="flex flex-col"><span className="font-medium">Atualizar</span><span className="text-[10px] text-gray-400">v{appVersion}</span></div>
              </button>
              <div className="h-px bg-gray-100 my-1" />
              <button onClick={logout} className="flex items-center gap-3 p-3 w-full text-left text-red-600 hover:bg-red-50 rounded-lg">
                <LogOut size={18} /> <span className="font-medium">Sair</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* MODAL IOS (MANTIDO) */}
      {showIOSInstructions && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative">
            <button onClick={() => setShowIOSInstructions(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 bg-gray-100 p-1 rounded-full"><X size={20} /></button>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-blue-50 p-4 rounded-full"><Download size={32} className="text-blue-600" /></div>
              <h3 className="text-xl font-bold text-gray-800">Instalar no iPhone</h3>
              <p className="text-sm text-gray-600">Toque em <strong>Compartilhar</strong> <Share size={14} className="inline" /> e depois em <strong>"Adicionar à Tela de Início"</strong>.</p>
              <button onClick={() => setShowIOSInstructions(false)} className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg">Entendi</button>
            </div>
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGAÇÃO MOBILE */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-slate-800 border-t border-slate-700 text-white flex justify-between items-center px-2 pb-safe z-50 h-16">
        <MobileNavLink to="/" icon={LayoutDashboard} label="Início" />
        <MobileNavLink to="/publicadores" icon={Users} label="Pubs" />
        <Link to="/relatorios" className="-mt-6 bg-blue-600 p-3 rounded-full shadow-lg border-4 border-gray-100 text-white hover:bg-blue-700 transition"><FileText size={24} /></Link>

        {/* Renderiza Reuniões apenas se Admin */}
        {isAdmin ? (
          <MobileNavLink to="/reunioes" icon={CalendarCheck} label="Reuniões" />
        ) : (
          // Se não for admin, coloca um placeholder invisível para manter o espaçamento ou nada
          <div className="w-16" />
        )}

        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`flex flex-col items-center text-[10px] gap-1 p-2 rounded transition-colors w-full ${mobileMenuOpen ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}>
          <MoreHorizontal size={22} /> <span className="font-medium">Mais</span>
        </button>
      </div>

      <main className="flex-1 overflow-y-auto bg-gray-50 pb-24 md:pb-0 scroll-smooth relative w-full h-full">{children}</main>
    </div>
  );
};

// --- 4. APP PRINCIPAL ---

export default function App() {
  return (
    <PWAProvider>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* ROTAS PÚBLICAS (Para quem tem login) */}
            <Route path="/" element={<PrivateRoute><LayoutSistema><Dashboard /></LayoutSistema></PrivateRoute>} />
            <Route path="/publicadores" element={<PrivateRoute><LayoutSistema><ListaPublicadores /></LayoutSistema></PrivateRoute>} />
            <Route path="/publicadores/:id" element={<PrivateRoute><LayoutSistema><DetalhesPublicador /></LayoutSistema></PrivateRoute>} />
            <Route path="/relatorios" element={<PrivateRoute><LayoutSistema><VisaoGeralRelatorios /></LayoutSistema></PrivateRoute>} />

            {/* ROTAS PROTEGIDAS (Apenas Admin) */}
            <Route path="/publicadores/novo" element={<AdminRoute><LayoutSistema><NovoPublicador /></LayoutSistema></AdminRoute>} />
            <Route path="/publicadores/editar/:id" element={<AdminRoute><LayoutSistema><NovoPublicador /></LayoutSistema></AdminRoute>} />
            <Route path="/reunioes" element={<AdminRoute><LayoutSistema><ControleAssistencia /></LayoutSistema></AdminRoute>} />
            <Route path="/configuracoes" element={<AdminRoute><LayoutSistema><Configuracoes /></LayoutSistema></AdminRoute>} />
            <Route path="/impressao-lote" element={<AdminRoute><LayoutSistema><ImpressaoLote /></LayoutSistema></AdminRoute>} />

            <Route path="*" element={<Navigate to="/" />} />

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </PWAProvider>
  );
}