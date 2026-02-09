import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarCheck, FileText, Settings, RefreshCw, LogOut, FileBarChart, Printer } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

// CONTEXTO DE SEGURANÇA
import { AuthProvider, useAuth } from './contexts/AuthContext';

// PÁGINAS
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NovoPublicador from './pages/Publicadores/NovoPublicador';
import ListaPublicadores from './pages/Publicadores/ListaPublicadores';
import DetalhesPublicador from './pages/Publicadores/DetalhesPublicador';
import ControleAssistencia from './pages/Reunioes/ControleAssistencia';
import VisaoGeralRelatorios from './pages/Relatorios/VisaoGeralRelatorios';
import RelatorioS1 from './pages/Relatorios/RelatorioS1';
import ImpressaoLote from './pages/Relatorios/ImpressaoLote'; // <--- NOVA IMPORTAÇÃO
import Configuracoes from './pages/Configuracoes/Configuracoes';

// --- COMPONENTES AUXILIARES ---

// Rota Privada: Só deixa passar se estiver logado e permitido
const PrivateRoute = ({ children }) => {
  const { user, isPermitted } = useAuth();
  if (!user || !isPermitted) {
    return <Navigate to="/login" />;
  }
  return children;
};

// Sidebar Link (Desktop)
const NavLink = ({ to, icon: Icon, label }) => {
  const location = useLocation();
  // Garante que o link só fica ativo se for a rota exata ou sub-rota
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to + '/'));

  return (
    <Link to={to} className={`flex items-center gap-3 p-3 rounded transition-colors duration-200 ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300 hover:text-white'}`}>
      <Icon size={20} /> <span className="font-medium">{label}</span>
    </Link>
  );
};

// Mobile Link
const MobileNavLink = ({ to, icon: Icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to + '/'));
  return (
    <Link to={to} className={`flex flex-col items-center text-xs gap-1 p-2 rounded transition-colors ${isActive ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}>
      <Icon size={20} /> <span>{label}</span>
    </Link>
  );
};

// --- LAYOUT INTERNO (Com Sidebar e Menu) ---
const LayoutSistema = ({ children }) => {
  const { logout, user } = useAuth();
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'Dev';

  const verificarAtualizacao = () => {
    if (window.confirm("Recarregar para verificar atualizações?")) window.location.reload();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex w-64 bg-slate-800 text-white flex-col shadow-xl z-20">
        <div className="p-6 text-center font-bold text-xl border-b border-slate-700 tracking-wide">S-21 Digital</div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavLink to="/" icon={LayoutDashboard} label="Visão Geral" />
          <NavLink to="/publicadores" icon={Users} label="Publicadores" />
          <NavLink to="/relatorios" icon={FileText} label="Relatórios" />
          <NavLink to="/totais-s1" icon={FileBarChart} label="Totais S-1" />

          {/* Link para Impressão (Opcional na Sidebar, pois é uma ferramenta específica) */}
          <NavLink to="/impressao-lote" icon={Printer} label="Imprimir S-21" />

          <NavLink to="/reunioes" icon={CalendarCheck} label="Reuniões" />
          <div className="pt-4 mt-4 border-t border-slate-700">
            <NavLink to="/configuracoes" icon={Settings} label="Ajustes" />
          </div>
        </nav>

        {/* RODAPÉ SIDEBAR */}
        <div className="p-4 bg-slate-900 border-t border-slate-700 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-2">
            <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-600" />
            <div className="overflow-hidden">
              <p className="text-xs text-white font-bold truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-slate-800 pt-2">
            <button onClick={verificarAtualizacao} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-white" title="Versão">
              <RefreshCw size={10} /> v{appVersion}
            </button>
            <button onClick={logout} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300" title="Sair">
              <LogOut size={10} /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE MENU */}
      <div className="md:hidden fixed bottom-0 w-full bg-slate-800 border-t border-slate-700 text-white flex justify-around items-center p-1 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <MobileNavLink to="/" icon={LayoutDashboard} label="Início" />
        <MobileNavLink to="/publicadores" icon={Users} label="Pubs" />
        <MobileNavLink to="/relatorios" icon={FileText} label="Relat." />
        <MobileNavLink to="/reunioes" icon={CalendarCheck} label="Reuniões" />
        <MobileNavLink to="/configuracoes" icon={Settings} label="Ajus." />
      </div>

      {/* CONTEÚDO */}
      <main className="flex-1 overflow-auto bg-gray-50 pb-24 md:pb-0 scroll-smooth">
        {children}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* ROTAS COM SIDEBAR */}
          <Route path="/" element={<PrivateRoute><LayoutSistema><Dashboard /></LayoutSistema></PrivateRoute>} />
          <Route path="/publicadores" element={<PrivateRoute><LayoutSistema><ListaPublicadores /></LayoutSistema></PrivateRoute>} />
          <Route path="/publicadores/novo" element={<PrivateRoute><LayoutSistema><NovoPublicador /></LayoutSistema></PrivateRoute>} />
          <Route path="/publicadores/:id" element={<PrivateRoute><LayoutSistema><DetalhesPublicador /></LayoutSistema></PrivateRoute>} />

          <Route path="/relatorios" element={<PrivateRoute><LayoutSistema><VisaoGeralRelatorios /></LayoutSistema></PrivateRoute>} />
          <Route path="/totais-s1" element={<PrivateRoute><LayoutSistema><RelatorioS1 /></LayoutSistema></PrivateRoute>} />

          <Route path="/reunioes" element={<PrivateRoute><LayoutSistema><ControleAssistencia /></LayoutSistema></PrivateRoute>} />
          <Route path="/configuracoes" element={<PrivateRoute><LayoutSistema><Configuracoes /></LayoutSistema></PrivateRoute>} />

          {/* ROTA SEM SIDEBAR (Para Impressão Limpa) */}
          <Route path="/impressao-lote" element={<PrivateRoute><ImpressaoLote /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}