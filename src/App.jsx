import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, CalendarCheck, FileText, Settings, 
  RefreshCw, LogOut, Printer, FileBarChart 
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NovoPublicador from './pages/Publicadores/NovoPublicador';
import ListaPublicadores from './pages/Publicadores/ListaPublicadores';
import DetalhesPublicador from './pages/Publicadores/DetalhesPublicador';
import ControleAssistencia from './pages/Reunioes/ControleAssistencia';
import VisaoGeralRelatorios from './pages/Relatorios/VisaoGeralRelatorios';
import ImpressaoLote from './pages/Relatorios/ImpressaoLote';
import Configuracoes from './pages/Configuracoes/Configuracoes';
import ImportarDados from './pages/Admin/ImportarDados';
import ImportarRelatorios from './pages/Admin/ImportarRelatorios';

const PrivateRoute = ({ children }) => {
  const { user, isPermitted } = useAuth();
  if (!user || !isPermitted) return <Navigate to="/login" />;
  return children;
};

const NavLink = ({ to, icon: Icon, label }) => {
  const location = useLocation();
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

const LayoutSistema = ({ children }) => {
  const { logout, user } = useAuth();
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'Dev';
  const verificarAtualizacao = () => { if (window.confirm("Recarregar?")) window.location.reload(); };

  return (
    // CORREÇÃO AQUI: h-screen e overflow-hidden para travar a tela e rolar só o main
    <div className="flex h-screen w-screen bg-gray-100 overflow-hidden">
      
      {/* MENU LATERAL */}
      <aside className="hidden md:flex w-64 bg-slate-800 text-white flex-col shadow-xl z-20 shrink-0">
        <div className="p-6 text-center font-bold text-xl border-b border-slate-700 tracking-wide">S-21 Digital</div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          <NavLink to="/" icon={LayoutDashboard} label="Visão Geral" />
          <NavLink to="/publicadores" icon={Users} label="Publicadores" />
          <NavLink to="/relatorios" icon={FileText} label="Relatórios & S-1" />
          <NavLink to="/reunioes" icon={CalendarCheck} label="Reuniões" />
          <div className="pt-4 mt-4 border-t border-slate-700">
            <p className="px-3 text-xs font-bold text-slate-500 uppercase mb-2">Ferramentas</p>
            <NavLink to="/impressao-lote" icon={Printer} label="Imprimir S-21" />
            <NavLink to="/configuracoes" icon={Settings} label="Configurações" />
          </div>
        </nav>
        <div className="p-4 bg-slate-900 border-t border-slate-700 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-2">
            <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-600" />
            <div className="overflow-hidden">
              <p className="text-xs text-white font-bold truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <div className="flex justify-between items-center border-t border-slate-800 pt-2">
            <button onClick={verificarAtualizacao} className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-white"><RefreshCw size={10} /> v{appVersion}</button>
            <button onClick={logout} className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-300"><LogOut size={10} /> Sair</button>
          </div>
        </div>
      </aside>

      {/* MENU MOBILE */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-slate-800 border-t border-slate-700 text-white flex justify-between items-center px-2 pb-safe z-50 h-16">
        <MobileNavLink to="/" icon={LayoutDashboard} label="Início" />
        <MobileNavLink to="/publicadores" icon={Users} label="Pubs" />
        <Link to="/relatorios" className="-mt-6 bg-blue-600 p-3 rounded-full shadow-lg border-4 border-gray-100 text-white hover:bg-blue-700 transition"><FileText size={24} /></Link>
        <MobileNavLink to="/reunioes" icon={CalendarCheck} label="Reuniões" />
        <MobileNavLink to="/configuracoes" icon={Settings} label="Ajustes" />
      </div>

      {/* ÁREA PRINCIPAL COM SCROLL */}
      <main className="flex-1 overflow-y-auto bg-gray-50 pb-24 md:pb-0 scroll-smooth relative w-full h-full">
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
          <Route path="/" element={<PrivateRoute><LayoutSistema><Dashboard /></LayoutSistema></PrivateRoute>} />
          <Route path="/publicadores" element={<PrivateRoute><LayoutSistema><ListaPublicadores /></LayoutSistema></PrivateRoute>} />
          <Route path="/publicadores/novo" element={<PrivateRoute><LayoutSistema><NovoPublicador /></LayoutSistema></PrivateRoute>} />
          <Route path="/publicadores/:id" element={<PrivateRoute><LayoutSistema><DetalhesPublicador /></LayoutSistema></PrivateRoute>} />
          <Route path="/publicadores/editar/:id" element={<PrivateRoute><LayoutSistema><NovoPublicador /></LayoutSistema></PrivateRoute>} />
          <Route path="/relatorios" element={<PrivateRoute><LayoutSistema><VisaoGeralRelatorios /></LayoutSistema></PrivateRoute>} />
          <Route path="/reunioes" element={<PrivateRoute><LayoutSistema><ControleAssistencia /></LayoutSistema></PrivateRoute>} />
          <Route path="/configuracoes" element={<PrivateRoute><LayoutSistema><Configuracoes /></LayoutSistema></PrivateRoute>} />
          <Route path="/importar-temp" element={<PrivateRoute><ImportarDados /></PrivateRoute>} />
          <Route path="/importar-historico" element={<PrivateRoute><ImportarRelatorios /></PrivateRoute>} />
          <Route path="/impressao-lote" element={<PrivateRoute><ImpressaoLote /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}