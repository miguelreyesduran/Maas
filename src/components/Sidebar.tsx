import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

export default function Sidebar() {
  const { profile, logOut } = useAuth();
  const isAdmin = profile?.role === UserRole.ADMIN;
  const isSupervisor = profile?.role === UserRole.SUPERVISOR;

  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard / Inicio' },
    { to: '/evaluations', icon: FileText, label: (isAdmin || isSupervisor) ? 'Lista de Evaluaciones' : 'Mis Evaluaciones' },
  ];

  if (isAdmin) {
    links.push({ to: '/collaborators', icon: Users, label: 'Gestión / Usuarios' });
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-50">
      <div className="p-6 flex items-center gap-3 border-b border-slate-50">
        <div className="bg-indigo-600 p-2 rounded-lg text-white">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-tighter leading-none">Protocolo</h1>
          <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">Gestión 360°</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all
              ${isActive 
                ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:bg-slate-50'
              }
            `}
          >
            <link.icon size={18} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-50 space-y-4">
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sesión Activa</p>
          <p className="text-xs font-black text-slate-900 truncate">{profile?.name}</p>
          <p className="text-[10px] font-medium text-slate-500 truncate">{profile?.role}</p>
        </div>
        
        <button 
          onClick={() => logOut()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 transition-all"
        >
          <LogOut size={18} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
