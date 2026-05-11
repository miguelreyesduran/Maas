import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, LogIn, ChevronRight, Mail, Lock } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const { signIn, loginWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailLogin, setIsEmailLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      console.error("Error de login:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('El ingreso por email/contraseña no está habilitado en Firebase. Por favor, actívelo en la consola de Firebase o use Google Auth.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email o contraseña incorrectos. Por favor verifique sus datos.');
      } else {
        setError(`Error: ${err.message || 'Ocurrió un problema al iniciar sesión.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Por favor, ingrese su email para restablecer la contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth } = await import('../lib/firebase');
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError('');
    } catch (err: any) {
      console.error("Error reset password:", err);
      setError(`No se pudo enviar el correo: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 z-10 border border-slate-200/50"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
            <ClipboardList size={28} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">EvaluApp</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">HR Performance OS</p>
          </div>
        </div>
        
        <h2 className="text-lg font-bold text-slate-900 mb-2">Ingreso al Sistema</h2>
        <p className="text-xs text-slate-500 mb-8 leading-relaxed">
          {isEmailLogin 
            ? 'Use las credenciales asignadas por su administrador.' 
            : 'Utilice su cuenta corporativa para acceder.'}
        </p>

        {isEmailLogin ? (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Usuario / Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 transition-all"
                  placeholder="ejemplo@empresa.com"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Contraseña</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && <p className="text-[10px] font-bold text-rose-500 bg-rose-50 p-2 rounded-lg text-center leading-tight">{error}</p>}
            {resetSent && <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 p-2 rounded-lg text-center leading-tight">Se ha enviado un correo para restablecer su contraseña. Revise su bandeja de entrada.</p>}

            <button
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-3 group transition-all active:scale-[0.98] shadow-xl shadow-slate-900/10 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Validando...' : 'Iniciar Sesión'}
              {!loading && <ChevronRight size={16} className="text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all" />}
            </button>

            <div className="flex flex-col gap-2 pt-2">
              <button 
                type="button"
                onClick={handleResetPassword}
                className="w-full text-center text-[9px] font-bold text-indigo-600 uppercase tracking-widest hover:underline transition-colors"
                disabled={loading}
              >
                ¿Olvidó su contraseña?
              </button>
              
              <button 
                type="button"
                onClick={() => setIsEmailLogin(false)}
                className="w-full text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
              >
                O usar Google Auth
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => signIn()}
              className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-bold py-3.5 px-6 rounded-xl flex items-center justify-between group transition-all active:scale-[0.98] shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                  <LogIn size={16} />
                </div>
                <span className="text-sm">Google Workspace</span>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
            </button>
            <button 
              onClick={() => setIsEmailLogin(true)}
              className="w-full text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors pt-2"
            >
              Volver a Usuario/Contraseña
            </button>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">MAAS SpA</span>
            <span className="text-[8px] font-medium text-slate-300">v2.5.0 • Credential Access</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold text-emerald-600 uppercase">Seguro</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
