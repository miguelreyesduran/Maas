import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, or } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Evaluation, EvaluationStatus, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, CheckCircle2, Clock, ChevronRight, AlertCircle, Calendar, User } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export default function CollaboratorDashboard() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;
    
    // Mostramos evaluaciones donde el usuario es el evaluado O es responsable de alguna métrica
    const q = query(
      collection(db, 'evaluations'), 
      or(
        where('collaboratorId', '==', profile.uid),
        where('collaboratorEmail', '==', profile.email),
        where('responsibles.prevencion', '==', profile.email),
        where('responsibles.calidad', '==', profile.email),
        where('responsibles.conducta', '==', profile.email),
        where('responsibles.desempeno', '==', profile.email)
      ),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const evals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation));
      setEvaluations(evals);
      setLoading(false);
    });

    return unsubscribe;
  }, [profile]);

  const isResponsibleOnly = (ev: Evaluation) => {
    return ev.collaboratorEmail !== profile?.email && ev.collaboratorId !== profile?.uid;
  };

  const pendingCount = evaluations.filter(e => e.status === EvaluationStatus.PENDING).length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-10 text-center sm:text-left">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-2">Mi Terminal de Desempeño</h1>
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em]">Historial y Estatus Individual</p>
      </div>

      {pendingCount > 0 && (
        <motion.div 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-indigo-900 text-white p-5 rounded-xl mb-8 flex items-center gap-4 shadow-xl shadow-indigo-600/10 border border-indigo-700"
        >
          <div className="bg-white/10 p-2.5 rounded-lg text-emerald-400 animate-pulse">
            <AlertCircle size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">Protocolos Pendientes ({pendingCount})</p>
            <p className="text-[10px] text-indigo-300 font-medium uppercase tracking-wider">Completa tu reporte para la consolidación mensual.</p>
          </div>
          <button className="bg-white text-indigo-900 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-50 transition-colors">
            Atender Ahora
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {evaluations.length === 0 && !loading && (
          <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <ClipboardList size={40} className="mx-auto text-slate-200 mb-4" />
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Sin registros asignados</p>
          </div>
        )}

        {evaluations.map((ev) => (
          <Link 
            key={ev.id} 
            to={`/evaluation/${ev.id}`}
            className="block group"
          >
            <div className="bg-white px-6 py-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-600 transition-all flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  ev.status === EvaluationStatus.COMPLETED 
                  ? 'bg-emerald-50 text-emerald-600' 
                  : isResponsibleOnly(ev)
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-400'
                }`}>
                  {ev.status === EvaluationStatus.COMPLETED 
                    ? <CheckCircle2 size={24} strokeWidth={2.5} /> 
                    : isResponsibleOnly(ev) 
                      ? <User size={24} strokeWidth={2.5} />
                      : <Calendar size={24} strokeWidth={2.5} />
                  }
                </div>
                
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-bold text-slate-900">
                      {isResponsibleOnly(ev) ? `Evaluación: ${ev.collaboratorName}` : 'Mi Evaluación'}
                    </h3>
                    <span className={`badge-status ${
                      ev.status === EvaluationStatus.COMPLETED 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : isResponsibleOnly(ev)
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {ev.status === EvaluationStatus.COMPLETED ? 'Finalizado' : isResponsibleOnly(ev) ? 'Por Evaluar' : 'Pendiente'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Clock size={10} /> {format(ev.createdAt?.toDate?.() || new Date(), 'dd MMM, yyyy', { locale: es })}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {ev.overallScore && (
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest leading-none mb-1">Puntaje</div>
                    <div className="text-xl font-black text-slate-900">{ev.overallScore.toFixed(1)}</div>
                  </div>
                )}
                <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center text-slate-200 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all">
                  <ChevronRight size={18} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      <footer className="mt-20 pt-8 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-300 uppercase tracking-widest">
        <span>EvaluApp Performance OS v2.4</span>
        <div className="flex gap-4">
          <span className="text-emerald-500">Conexión Segura</span>
          <span>Sincronizado</span>
        </div>
      </footer>
    </div>
  );
}
