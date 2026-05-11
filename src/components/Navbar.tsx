import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User as UserIcon, LayoutDashboard, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserRole } from '../types';

export default function Navbar() {
  const { profile, logOut } = useAuth();

  return (
    <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-600/20">
            E
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight text-slate-900">EvaluApp</h1>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Performance OS</p>
          </div>
        </Link>
        
        <div className="hidden md:flex items-center gap-2">
          <Link to="/" className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-2 py-2 px-4 rounded-lg hover:bg-slate-50 transition-all uppercase tracking-wider">
            <LayoutDashboard size={14} />
            Dashboard
          </Link>
          {profile?.role === UserRole.ADMIN && (
            <Link to="/admin/evaluations" className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-2 py-2 px-4 rounded-lg hover:bg-slate-50 transition-all uppercase tracking-wider">
              <ClipboardList size={14} />
              Gestión
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3 pr-5 border-r border-slate-100">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-slate-900 leading-none mb-1">{profile?.name}</div>
            <span className="text-[9px] uppercase tracking-[0.1em] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {profile?.role === UserRole.ADMIN ? 'Administrador' : 'Colaborador'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-indigo-100 flex items-center justify-center text-indigo-600">
            <UserIcon size={18} strokeWidth={2.5} />
          </div>
        </div>
        
        <button 
          onClick={() => logOut()}
          className="text-slate-400 hover:text-rose-500 transition-colors p-2"
          title="Cerrar sesión"
        >
          <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
}
