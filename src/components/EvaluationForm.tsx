import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Evaluation, EvaluationStatus, EvaluationMetrics, UserRole, OperationType } from '../types';
import { useAuth, handleFirestoreError } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { ChevronLeft, Send, Sparkles, Star, Target, ShieldCheck, Zap, MessageSquare, ClipboardList, Info, LineChart, Award, Printer, Lock, Unlock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateFeedback } from '../services/aiService';

const METRICS_LIST = [
  { id: 'prevencion' as keyof EvaluationMetrics, label: 'Prevención', description: 'Evaluación del cumplimiento de normas de seguridad y salud.', icon: ShieldCheck },
  { id: 'calidad' as keyof EvaluationMetrics, label: 'Calidad', description: 'Precisión técnica y adherencia a estándares de calidad.', icon: Target },
  { id: 'conducta' as keyof EvaluationMetrics, label: 'Conducta', description: 'Comportamiento, ética y relaciones interpersonales.', icon: MessageSquare },
  { id: 'desempeno' as keyof EvaluationMetrics, label: 'Desempeño', description: 'Productividad y cumplimiento de objetivos técnicos.', icon: Zap }
];

interface SectionQuestionsProps {
  sectionId: keyof EvaluationMetrics;
  metrics: EvaluationMetrics;
  setMetrics: React.Dispatch<React.SetStateAction<EvaluationMetrics>>;
  isReadOnly: boolean;
  enabled: boolean;
}

const TEMPLATE_OPERATIVO = {
  prevencion: [
    { id: 'epp', label: 'Usa EPP de acuerdo a su actividad en el área de trabajo', type: 'scale' },
    { id: 'cultura', label: 'Mantiene y fomenta una cultura preventiva en su entorno de trabajo', type: 'scale' },
    { id: 'reportabilidad', label: 'Reporta condiciones inseguras y/o incidentes de manera oportuna', type: 'scale' },
    { id: 'orden', label: 'Coopera con el orden, aseo y mantención del área de trabajo', type: 'scale' },
    { id: 'incidentes', label: 'Si hay incidentes de seguridad, indique la clasificación', type: 'incident' },
  ],
  calidad: [
    { id: 'procedimiento', label: 'Utiliza el procedimiento de trabajo indicado para su actividad', type: 'scale' },
    { id: 'estandares', label: 'Mantiene estándares de calidad en los trabajos que ejecuta', type: 'scale' },
    { id: 'noConformidades', label: 'Presenta de forma proactiva informe de no conformidades detectadas', type: 'scale' },
    { id: 'clasificacionNoConformidades', label: 'Si hay no conformidades, identifique la clasificación', type: 'incident' },
  ],
  conducta: [
    { id: 'puntualidad', label: 'Puntualidad y asistencia al trabajo', type: 'scale' },
    { id: 'respeto', label: 'Mantiene respeto hacia compañeros y jefatura', type: 'scale' },
    { id: 'salida', label: 'Mantiene puntualidad en la hora de salida del trabajo', type: 'scale' },
  ],
  desempeno: [
    { id: 'perfil', label: 'Cumple con el perfil del cargo y sus responsabilidades asignadas', type: 'scale' },
    { id: 'avance', label: 'Avance físico (PF) del período supervisado', type: 'avance' },
    { id: 'instrucciones', label: 'Sigue las instrucciones que se le imparten', type: 'scale' },
    { id: 'interes', label: 'Muestra interés y aporta ideas en la ejecución del trabajo', type: 'scale' },
  ],
};

const TEMPLATE_STAFF = {
  prevencion: [
    { id: 'liderazgo', label: 'Ejerce liderazgo preventivo y predica con el ejemplo', type: 'scale' },
    { id: 'gestion_riesgos', label: 'Gestiona oportunamente los riesgos en sus procesos/áreas', type: 'scale' },
    { id: 'cumplimiento_legal', label: 'Asegura cumplimiento de protocolos y leyes laborales', type: 'scale' },
    { id: 'reportabilidad', label: 'Fomenta la reportabilidad y análisis de causas raíz', type: 'scale' },
    { id: 'incidentes', label: 'Clasificación de incidentes en su área de gestión', type: 'incident' },
  ],
  calidad: [
    { id: 'planificacion', label: 'Planificación y control de aseguramiento de calidad', type: 'scale' },
    { id: 'mejora_continua', label: 'Propone e implementa acciones de mejora continua (KAIZEN)', type: 'scale' },
    { id: 'noConformidades_gestion', label: 'Gestión efectiva de no conformidades y cierre de hallazgos', type: 'scale' },
    { id: 'clasificacionNoConformidades', label: 'Si hay no conformidades, identifique la clasificación', type: 'incident' },
  ],
  conducta: [
    { id: 'clima_laboral', label: 'Fomenta un buen clima laboral y relaciones grupales', type: 'scale' },
    { id: 'valores_corporativos', label: 'Representa y transmite los valores corporativos', type: 'scale' },
    { id: 'comunicacion', label: 'Comunicación asertiva con subalternos y mandos superiores', type: 'scale' },
  ],
  desempeno: [
    { id: 'cumplimiento_kpi', label: 'Cumplimiento de KPIs y metas estratégicas del período', type: 'scale' },
    { id: 'avance_general', label: 'Avance general de los proyectos/áreas bajo su responsabilidad', type: 'avance' },
    { id: 'desarrollo_equipo', label: 'Potencia el desarrollo y capacitación de su personal', type: 'scale' },
    { id: 'eficiencia_recursos', label: 'Optimización y buen uso de recursos/presupuesto', type: 'scale' },
  ],
};

function getTemplateForPosition(position: string = '') {
  const staffPositions = [
    'administrador', 'jefe de terreno', 'calidad', 'inspección técnica', 
    'ito', 'supervisor', 'capataz', 'profesional', 'jefe', 'encargado',
    'gerente', 'coordinador', 'ingeniero', 'arquitecto', 'administrativo'
  ];
  
  const normalized = position.toLowerCase();
  const isStaff = staffPositions.some(p => normalized.includes(p));
  
  return isStaff ? 'staff' : 'operativo';
}

function getTemplateContent(type: 'staff' | 'operativo') {
  return type === 'staff' ? TEMPLATE_STAFF : TEMPLATE_OPERATIVO;
}

const METRICS_LABELS = {
  STAFF: {
    prevencion: 'Gestión Preventiva',
    calidad: 'Gestión de Calidad',
    conducta: 'Liderazgo y Conducta',
    desempeno: 'Resultados Estratégicos'
  },
  OPERATIVO: {
    prevencion: 'Seguridad y Salud',
    calidad: 'Calidad Ejecutiva',
    conducta: 'Conducta e Integridad',
    desempeno: 'Desempeño Técnico'
  }
};

interface SectionQuestionsProps {
  sectionId: keyof EvaluationMetrics;
  metrics: EvaluationMetrics;
  setMetrics: React.Dispatch<React.SetStateAction<EvaluationMetrics>>;
  isReadOnly: boolean;
  enabled: boolean;
  position?: string;
  templateType: 'staff' | 'operativo';
}

function SectionQuestions({ sectionId, metrics, setMetrics, isReadOnly, enabled, templateType }: SectionQuestionsProps) {
  const template = getTemplateContent(templateType);
  const subQuestions = (template as any)[sectionId] || [];
  const sectionData = (metrics[sectionId] as any) || {};

  const handleUpdate = (questionId: string, value: any) => {
    setMetrics(prev => ({
      ...prev,
      [sectionId]: {
        ...(prev[sectionId] as any),
        [questionId]: value
      }
    }));
  };

  return (
    <div className="space-y-8">
      {subQuestions.map((q) => (
        <div key={q.id} className="space-y-4">
          <div className="flex items-center gap-3">
            <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{q.label}</h4>
          </div>

          {q.type === 'scale' && (
            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4].map((val) => (
                <button
                  key={val}
                  disabled={isReadOnly || !enabled}
                  onClick={() => handleUpdate(q.id, val)}
                  className={`flex-1 min-w-[100px] h-14 rounded-xl px-4 flex flex-col items-center justify-center transition-all ${
                    sectionData[q.id] === val 
                    ? 'bg-indigo-600 text-white shadow-lg scale-105' 
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  } disabled:opacity-50`}
                >
                  <span className="text-sm font-black">{val}</span>
                  <span className="text-[8px] font-bold uppercase tracking-tighter mt-1">
                    {val === 1 && 'No cumple'}
                    {val === 2 && 'Parcial'}
                    {val === 3 && 'Cumple'}
                    {val === 4 && 'Destaque'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {q.type === 'incident' && (
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'sin', label: q.id === 'clasificacionNoConformidades' ? 'Sin NC' : 'Sin incidentes' },
                { id: 'leve', label: 'Leve' },
                { id: 'normal', label: 'Normal' },
                { id: 'grave', label: 'Grave' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  disabled={isReadOnly || !enabled}
                  onClick={() => handleUpdate(q.id, opt.id)}
                  className={`flex-1 min-w-[100px] h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    sectionData[q.id] === opt.id 
                    ? 'bg-rose-600 text-white shadow-lg' 
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {q.type === 'avance' && (
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: '100', label: '>= 100%' },
                { id: '90', label: '90 - 99%' },
                { id: '80', label: '80 - 89%' },
                { id: 'lower', label: '< 80%' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  disabled={isReadOnly || !enabled}
                  onClick={() => handleUpdate(q.id, opt.id)}
                  className={`flex-1 min-w-[100px] h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    sectionData[q.id] === opt.id 
                    ? 'bg-amber-500 text-white shadow-lg' 
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                  } disabled:opacity-50`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function EvaluationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [metrics, setMetrics] = useState<EvaluationMetrics>({
    prevencion: {}, calidad: {}, conducta: {}, desempeno: {}
  });
  const [weights, setWeights] = useState({
    prevencion: 30, calidad: 20, conducta: 20, desempeno: 30
  });
  const [comments, setComments] = useState('');
  const [templateType, setTemplateType] = useState<'staff' | 'operativo'>('operativo');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!id) return;
    const fetchDoc = async () => {
      const snap = await getDoc(doc(db, 'evaluations', id));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Evaluation;
        setEvaluation(data);
        setTemplateType(data.templateType || getTemplateForPosition(data.position));
        if (data.metrics) setMetrics({
          prevencion: data.metrics.prevencion || {},
          calidad: data.metrics.calidad || {},
          conducta: data.metrics.conducta || {},
          desempeno: data.metrics.desempeno || {}
        });
        if (data.comments) setComments(data.comments);
      }
      
      // Fetch weights from config
      const configSnap = await getDoc(doc(db, 'settings', 'config'));
      if (configSnap.exists()) {
        const configData = configSnap.data();
        if (configData.weights) setWeights(configData.weights);
      }
      
      setLoading(false);
    };
    fetchDoc();
  }, [id]);

  const calculateSectionScore = (sectionId: keyof EvaluationMetrics) => {
    const section = metrics[sectionId] as any;
    if (!section) return 0;
    
    const values: number[] = [];
    Object.entries(section).forEach(([key, val]) => {
      if (typeof val === 'number') {
        values.push(val);
      } else if (key === 'incidentes' || key === 'clasificacionNoConformidades') {
        // Penalty for incidents / non-conformities
        if (val === 'sin') values.push(4);
        if (val === 'leve') values.push(3);
        if (val === 'normal') values.push(2);
        if (val === 'grave') values.push(1);
      } else if (key === 'avance') {
        if (val === '100') values.push(4);
        if (val === '90') values.push(3);
        if (val === '80') values.push(2);
        if (val === 'lower') values.push(1);
      }
    });

    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  const handleSubmit = async () => {
    if (!id || !evaluation || !profile) return;
    
    setIsSubmitting(true);
    
    // Calculate overall weighted score
    const scores = {
      prevencion: calculateSectionScore('prevencion'),
      calidad: calculateSectionScore('calidad'),
      conducta: calculateSectionScore('conducta'),
      desempeno: calculateSectionScore('desempeno'),
    };

    const overallScoreRaw = (
      (scores.prevencion * (weights.prevencion / 100)) +
      (scores.calidad * (weights.calidad / 100)) +
      (scores.conducta * (weights.conducta / 100)) +
      (scores.desempeno * (weights.desempeno / 100))
    );
    const overallScore = isNaN(overallScoreRaw) ? 0 : overallScoreRaw;

    // Is it fully completed?
    const template = getTemplateContent(templateType);
    const isFullyCompleted = METRICS_LIST.every(m => {
      const section = metrics[m.id as keyof EvaluationMetrics] as any;
      if (!section) return false;
      const count = Object.keys(section).length;
      const templateQuestions = (template as any)[m.id]?.length || 0;
      return count >= templateQuestions;
    });
    
    try {
      let aiFeedback = evaluation.aiFeedback;
      let aiManagementFeedback = evaluation.aiManagementFeedback;

      if (isFullyCompleted && !aiFeedback) {
        console.log('Solicitando análisis de IA...');
        try {
          const feedbackResult = await generateFeedback(
            evaluation.collaboratorName, 
            scores, 
            comments,
            templateType
          );
          aiFeedback = feedbackResult.collaborator;
          aiManagementFeedback = feedbackResult.management;
          console.log('Análisis de IA obtenido con éxito');
        } catch (aiErr) {
          console.error('Error in AI feedback generation:', aiErr);
          alert('Aviso: No se pudo conectar con el servicio de IA para el análisis automático, pero la evaluación técnica se guardará normalmente.');
        }
      }

      try {
        console.log('Guardando evaluación...');
        await updateDoc(doc(db, 'evaluations', id), {
          metrics,
          comments,
          aiFeedback,
          aiManagementFeedback,
          overallScore,
          templateType,
          status: isFullyCompleted ? EvaluationStatus.COMPLETED : EvaluationStatus.PENDING,
          updatedAt: serverTimestamp(),
        });
        console.log('Evaluación guardada exitosamente');
        alert("Evaluación guardada correctamente.");
        navigate('/');
      } catch (err: any) {
        console.error('Error detallado al guardar:', err);
        handleFirestoreError(err, OperationType.WRITE, `evaluations/${id}`);
      }
    } catch (error: any) {
      console.error('Error en proceso de envío:', error);
      alert("Error al procesar la evaluación: " + (error.message || 'Error desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDetailsView = searchParams.get('view') === 'details';

  if (loading) return <div className="flex justify-center p-20 text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Cargando Protocolo...</div>;
  if (!evaluation) return <div className="text-center p-20 text-xs font-bold text-slate-400 uppercase tracking-widest">Error: Protocolo no localizado</div>;

  const isAdmin = profile?.role === UserRole.ADMIN;
  const isSupervisor = profile?.role === UserRole.SUPERVISOR;
  const hasFillPermission = isAdmin || (isSupervisor && profile?.permissions?.canFillForms);
  const isReadOnly = (evaluation.status === EvaluationStatus.COMPLETED || isDetailsView) && (!isAdmin || !adminUnlocked);

  if (isDetailsView) {
    if (!isAdmin) {
      return (
        <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
          <ShieldCheck size={48} className="text-slate-300" />
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Acceso Restringido</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest max-w-xs">
            Solo el administrador tiene acceso a la visualización detallada y sugerencias estratégicas.
          </p>
          <button onClick={() => navigate(-1)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest">
            Volver
          </button>
        </div>
      );
    }

    const scores = {
      prevencion: calculateSectionScore('prevencion'),
      calidad: calculateSectionScore('calidad'),
      conducta: calculateSectionScore('conducta'),
      desempeno: calculateSectionScore('desempeno'),
    };

    return (
      <div className="max-w-6xl mx-auto px-6 py-12 pb-40 space-y-8 print:py-4 print:pb-4">
        <div className="flex items-center justify-between no-print">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-[10px] uppercase tracking-widest transition-colors"
          >
            <ChevronLeft size={16} />
            Volver al panel
          </button>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-white text-slate-900 border border-slate-200 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm no-print"
            >
              <Printer size={14} />
              Imprimir Reporte
            </button>
            <span className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full ${
              evaluation.templateType === 'staff' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {evaluation.templateType === 'staff' ? 'STAFF' : 'OPERATIVO'}
            </span>
            {evaluation.overallScore && (
              <div className="bg-slate-900 text-white px-6 py-2 rounded-xl flex items-center gap-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Puntaje Final</p>
                <p className="text-2xl font-black text-emerald-400">{evaluation.overallScore.toFixed(1)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Print Only Header */}
        <div className="hidden print:block border-b-2 border-slate-900 pb-6 mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">Reporte de Desempeño</h1>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Confidencial - Gestión de Talento</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-indigo-600">{evaluation.overallScore?.toFixed(1)} / 4.0</p>
              <p className="text-[10px] font-black uppercase">Calificación Global</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden print:shadow-none print:border-slate-300">
              <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 print:p-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">{evaluation.collaboratorName}</h1>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{evaluation.position} | {evaluation.area}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Evaluación</p>
                  <p className="text-sm font-bold text-slate-900">
                    {evaluation.date?.toDate ? format(evaluation.date.toDate(), 'dd MMMM, yyyy', { locale: es }) : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8 print:p-6 print:gap-4">
                {METRICS_LIST.map((m) => {
                  const score = scores[m.id as keyof typeof scores];
                  const percentage = (score / 4) * 100;
                  const weight = weights[m.id as keyof typeof weights];
                  const weightedContribution = ((score * weight) / 100).toFixed(2);
                  
                  return (
                    <div key={m.id} className="p-6 rounded-2xl border border-slate-100 bg-white hover:shadow-lg transition-all border-l-4" style={{ borderColor: score >= 3 ? '#10b981' : '#f59e0b' }}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
                            <m.icon size={20} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.label}</p>
                            <p className="text-xs font-bold text-slate-900">Peso: {weight}%</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-900">{score.toFixed(1)} <span className="text-[10px] text-slate-400">/ 4.0</span></p>
                          <p className="text-[9px] font-bold text-indigo-600 uppercase">Contribución: {weightedContribution}</p>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${score >= 3 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl p-10 space-y-8 print:shadow-none print:border-slate-300 print:p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center print:bg-transparent print:text-black">
                  <MessageSquare size={20} />
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Observaciones del Evaluador</h3>
              </div>
              <p className="text-sm text-slate-600 italic leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100 print:bg-transparent print:p-0 print:border-none">
                "{evaluation.comments || 'Sin observaciones adicionales para este período.'}"
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-indigo-900 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/40 print:bg-white print:text-black print:shadow-none print:border-2 print:border-slate-300">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none no-print">
                <Award size={120} strokeWidth={1} />
              </div>
              <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-6 relative z-10 print:text-black">
                <Sparkles size={14} fill="currentColor" />
                Informe para el Colaborador
              </div>
              <div className="text-indigo-50 text-xs font-medium leading-relaxed whitespace-pre-wrap relative z-10 min-h-[150px] print:text-black">
                {evaluation.aiFeedback || 'El informe detallado de la IA estará disponible una vez finalizada la evaluación.'}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] border-2 border-slate-900 p-8 relative overflow-hidden shadow-xl print:shadow-none print:border-slate-300">
              <div className="flex items-center gap-2 text-slate-900 text-[10px] font-black uppercase tracking-widest mb-6">
                <LineChart size={14} />
                Recomendaciones a Gerencia
              </div>
              <div className="text-slate-600 text-xs font-medium leading-relaxed whitespace-pre-wrap min-h-[150px] print:text-black">
                {evaluation.aiManagementFeedback || 'Las sugerencias estratégicas se generarán al completar todos los indicadores.'}
              </div>
            </div>

            <div className="bg-slate-50 rounded-[2rem] p-8 space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nivel de Desempeño</h4>
              <div className="space-y-3">
                {[
                  { label: 'Excepcional', range: '3.8 - 4.0', color: 'bg-emerald-500' },
                  { label: 'Cumple lo esperado', range: '3.0 - 3.7', color: 'bg-indigo-500' },
                  { label: 'Requiere mejora', range: '2.0 - 2.9', color: 'bg-amber-500' },
                  { label: 'Insuficiente', range: '< 2.0', color: 'bg-rose-500' },
                ].map((range) => (
                  <div key={range.label} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${range.color}`} />
                      <span className="text-[10px] font-bold text-slate-700">{range.label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">{range.range}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isResponsibleFor = (metricId: string) => {
    if (isAdmin) return true;
    const respEmail = evaluation.responsibles?.[metricId as keyof typeof evaluation.responsibles];
    return !respEmail || respEmail === profile?.email;
  };

  const canSave = !isReadOnly && hasFillPermission && (isAdmin || METRICS_LIST.some(m => isResponsibleFor(m.id)));

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 pb-40">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 font-bold text-[10px] uppercase tracking-widest transition-colors"
        >
          <ChevronLeft size={16} />
          Volver al panel
        </button>
        
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${
            evaluation.status === EvaluationStatus.COMPLETED 
            ? 'bg-emerald-100 text-emerald-700' 
            : 'bg-indigo-100 text-indigo-700'
          }`}>
             Status: {evaluation.status === EvaluationStatus.COMPLETED ? 'Finalizado' : 'En proceso'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-indigo-900 px-10 py-10 text-white relative">
          <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
            <ClipboardList size={120} strokeWidth={1} />
          </div>

          <div className="flex items-center gap-3 mb-4">
             <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ShieldCheck size={18} />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Formulario de Desempeño v2.4</span>
          </div>
          
          <h1 className="text-3xl font-black tracking-tight mb-8">Análisis de Competencias</h1>

          {isAdmin && evaluation.status === EvaluationStatus.COMPLETED && (
            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between no-print">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${adminUnlocked ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {adminUnlocked ? <Unlock size={16} /> : <Lock size={16} />}
                </div>
                <div>
                  <p className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Modo Administrador</p>
                  <p className="text-[10px] text-slate-500 font-medium">{adminUnlocked ? 'Edición habilitada para este protocolo' : 'Protocolo bloqueado por estar finalizado'}</p>
                </div>
              </div>
              <button 
                onClick={() => setAdminUnlocked(!adminUnlocked)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${adminUnlocked ? 'bg-slate-900 text-white' : 'bg-amber-500 text-white shadow-lg shadow-amber-200'}`}
              >
                {adminUnlocked ? 'Bloquear Cambios' : 'Habilitar Edición'}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-8 bg-black/20 p-1 rounded-xl w-fit">
            <button 
              disabled={isReadOnly}
              onClick={() => setTemplateType('operativo')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${templateType === 'operativo' ? 'bg-white text-indigo-900 shadow-xl' : 'text-indigo-300 hover:text-white'}`}
            >
              Formato Operativo
            </button>
            <button 
              disabled={isReadOnly}
              onClick={() => setTemplateType('staff')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${templateType === 'staff' ? 'bg-white text-indigo-900 shadow-xl' : 'text-indigo-300 hover:text-white'}`}
            >
              Formato Staff
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pt-8 border-t border-indigo-700/50">
            <div>
              <div className="text-indigo-300 text-[10px] font-black uppercase tracking-wider mb-1">Nombre Colaborador</div>
              <div className="text-sm font-bold text-white">{evaluation.collaboratorName}</div>
            </div>
            <div>
              <div className="text-indigo-300 text-[10px] font-black uppercase tracking-wider mb-1">Área / División</div>
              <div className="text-sm font-bold text-white">{evaluation.area}</div>
            </div>
            <div className="hidden md:block">
              <div className="text-indigo-300 text-[10px] font-black uppercase tracking-wider mb-1">Cargo Perfil</div>
              <div className="text-sm font-bold text-white uppercase">{evaluation.position}</div>
            </div>
            <div className="hidden md:block">
              <div className="text-indigo-300 text-[10px] font-black uppercase tracking-wider mb-1">ID Registro</div>
              <div className="text-sm font-mono font-bold text-indigo-400">{evaluation.id.slice(0, 8).toUpperCase()}</div>
            </div>
          </div>
        </div>

        <div className="p-10 space-y-12">
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
                Evaluación Cuantitativa
              </h2>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded">Escala: 1 (No cumple) - 4 (Destaque)</div>
            </div>

            <div className="space-y-16">
      {METRICS_LIST.map((m) => {
                const isStaff = templateType === 'staff';
                const labels = isStaff ? METRICS_LABELS.STAFF : METRICS_LABELS.OPERATIVO;
                const label = labels[m.id as keyof typeof labels] || m.label;

                return (
                  <div key={m.id} className="space-y-8">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <m.icon size={20} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{label}</h3>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{m.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {evaluation.responsibles?.[m.id as keyof typeof evaluation.responsibles] && (
                          <span className="text-[9px] bg-slate-100 text-slate-400 px-2 py-1 rounded font-black uppercase tracking-tighter">
                            Asignado: {evaluation.responsibles[m.id as keyof typeof evaluation.responsibles]}
                          </span>
                        )}
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg uppercase tracking-tighter">
                          {weights[m.id as keyof typeof weights]}% ponderación
                        </span>
                      </div>
                    </div>

                    <div className="space-y-10 pl-4">
                      <SectionQuestions 
                        sectionId={m.id} 
                        metrics={metrics} 
                        setMetrics={setMetrics} 
                        isReadOnly={isReadOnly}
                        enabled={isResponsibleFor(m.id)}
                        templateType={templateType}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="pt-12 border-t border-slate-100">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-8">
              <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
              Observaciones del Usuario
            </h2>
            <div className="relative">
              <textarea
                readOnly={isReadOnly || !canSave}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="PROPORCIONA DETALLES ESPECÍFICOS SOBRE EL DESEMPEÑO DEL PERÍODO..."
                className="w-full bg-slate-50 border-transparent focus:bg-white focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 rounded-2xl p-6 text-xs font-bold uppercase tracking-widest min-h-[140px] transition-all placeholder:text-slate-300 outline-none"
              />
              <div className="absolute bottom-4 right-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">{comments.length} / 2000</div>
            </div>
          </section>

          {evaluation.aiFeedback && (
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-900 rounded-[2.5rem] p-10 relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-12 text-indigo-800 opacity-20 pointer-events-none">
                <Sparkles size={160} strokeWidth={1} />
              </div>
              
              <div className="flex items-center gap-3 text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 relative z-10">
                <Sparkles size={16} fill="currentColor" />
                Sugerencias AI Generadas
              </div>
              
              <div className="text-indigo-50 text-sm font-medium leading-relaxed whitespace-pre-wrap relative z-10">
                {evaluation.aiFeedback}
              </div>

              <div className="mt-8 pt-8 border-t border-indigo-800 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-800 flex items-center justify-center text-indigo-400 font-bold text-xs uppercase">BI</div>
                  <div>
                    <p className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">Motor de Análisis v3.0</p>
                    <p className="text-[9px] font-medium text-indigo-400 mt-1 uppercase">Validación Heurística de Datos</p>
                  </div>
                </div>
                {evaluation.overallScore && (
                  <div className="text-right">
                    <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.2em] mb-1">Índice Global</p>
                    <p className="text-2xl font-black text-white leading-none">{evaluation.overallScore.toFixed(1)}</p>
                  </div>
                )}
              </div>
            </motion.section>
          )}
        </div>
      </div>

      {canSave && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-sm px-4">
          <button
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-4 transition-all shadow-2xl shadow-emerald-500/30 active:scale-[0.98] uppercase text-xs tracking-[0.2em]"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Actualizando Registro...
              </div>
            ) : (
              <>
                <Send size={16} />
                Guardar Progreso
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
