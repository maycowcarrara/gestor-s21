import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarCheck, FileText } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

// IMPORTAÇÕES DAS PÁGINAS
import Dashboard from './pages/Dashboard';
import NovoPublicador from './pages/Publicadores/NovoPublicador';
import ListaPublicadores from './pages/Publicadores/ListaPublicadores';
import DetalhesPublicador from './pages/Publicadores/DetalhesPublicador';
import ControleAssistencia from './pages/Reunioes/ControleAssistencia';
import VisaoGeralRelatorios from './pages/Relatorios/VisaoGeralRelatorios'; // <--- NOVA PÁGINA

// Componente auxiliar para destacar o link ativo no menu
const NavLink = ({ to, icon: Icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-3 rounded transition-colors duration-200
        ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-700 text-slate-300 hover:text-white'}`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );
};

const MobileNavLink = ({ to, icon: Icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <Link
      to={to}
      className={`flex flex-col items-center text-xs gap-1 p-2 rounded transition-colors
        ${isActive ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );
};

function App() {
  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900">
      {/* Notificações (Toasts) */}
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />

      <BrowserRouter>
        <div className="flex h-screen overflow-hidden">

          {/* SIDEBAR (Desktop) */}
          <aside className="hidden md:flex w-64 bg-slate-800 text-white flex-col shadow-xl z-20">
            <div className="p-6 text-center font-bold text-xl border-b border-slate-700 tracking-wide">
              S-21 Digital
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              <NavLink to="/" icon={LayoutDashboard} label="Visão Geral" />
              <NavLink to="/publicadores" icon={Users} label="Publicadores" />
              <NavLink to="/relatorios" icon={FileText} label="Relatórios" />
              <NavLink to="/reunioes" icon={CalendarCheck} label="Reuniões" />
            </nav>

            <div className="p-4 text-xs text-slate-500 text-center border-t border-slate-700">
              v1.1.0 • Gestor S-21
            </div>
          </aside>

          {/* MENU MOBILE (Celular - Rodapé Fixo) */}
          <div className="md:hidden fixed bottom-0 w-full bg-slate-800 border-t border-slate-700 text-white flex justify-around items-center p-1 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <MobileNavLink to="/" icon={LayoutDashboard} label="Início" />
            <MobileNavLink to="/publicadores" icon={Users} label="Pubs" />
            <MobileNavLink to="/relatorios" icon={FileText} label="Relat." />
            <MobileNavLink to="/reunioes" icon={CalendarCheck} label="Reuniões" />
          </div>

          {/* ÁREA PRINCIPAL (Conteúdo) */}
          <main className="flex-1 overflow-auto bg-gray-50 pb-24 md:pb-0 scroll-smooth">
            <Routes>
              {/* Dashboard */}
              <Route path="/" element={<Dashboard />} />

              {/* Publicadores */}
              <Route path="/publicadores" element={<ListaPublicadores />} />
              <Route path="/publicadores/novo" element={<NovoPublicador />} />
              <Route path="/publicadores/:id" element={<DetalhesPublicador />} />

              {/* Relatórios (Visão Geral) */}
              <Route path="/relatorios" element={<VisaoGeralRelatorios />} />

              {/* Reuniões (Assistência) */}
              <Route path="/reunioes" element={<ControleAssistencia />} />
            </Routes>
          </main>

        </div>
      </BrowserRouter>
    </div>
  );
}

export default App;