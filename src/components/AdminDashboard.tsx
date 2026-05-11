import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, getDocs, getDoc, setDoc, serverTimestamp, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Evaluation, EvaluationStatus, UserProfile, UserRole, UserPermissions, OperationType } from '../types';
import { createNewUserWithPassword } from '../lib/auth-utils';
import { useAuth, handleFirestoreError } from '../contexts/AuthContext';
import { Plus, Download, Users, CheckCircle2, Clock, ChevronRight, Search, TrendingUp, Filter, Trash2, Edit2 } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface AdminDashboardProps {
  initialTab?: 'evaluations' | 'collaborators' | 'settings';
}

export default function AdminDashboard({ initialTab = 'evaluations' }: AdminDashboardProps) {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [collaborators, setCollaborators] = useState<UserProfile[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const isAdmin = profile?.role === UserRole.ADMIN || profile?.email === 'miguelreyesduran@gmail.com';
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'evaluations' | 'collaborators' | 'settings'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [editingCollab, setEditingCollab] = useState<UserProfile | null>(null);
  const [showRegModal, setShowRegModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedCollabId, setSelectedCollabId] = useState('');
  const [registrationRole, setRegistrationRole] = useState<UserRole>(UserRole.COLABORADOR);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const [responsibles, setResponsibles] = useState({
    prevencion: '',
    calidad: '',
    conducta: '',
    desempeno: ''
  });
  const [pendingCreation, setPendingCreation] = useState(false);
  const [pendingReg, setPendingReg] = useState(false);
  const [pendingImport, setPendingImport] = useState(false);
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [weights, setWeights] = useState({
    prevencion: 30,
    calidad: 20,
    conducta: 20,
    desempeno: 30
  });
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  const [permissions, setPermissions] = useState<UserPermissions>({
    canFillForms: true,
    canViewDashboard: false,
    canViewEvaluationsList: true
  });

  useEffect(() => {
    const q = query(collection(db, 'evaluations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const evals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Evaluation));
      setEvaluations(evals);
      setLoading(false);
    });

    const qUsers = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setCollaborators(allUsers);
      // Filtrar evaluadores (admins, el admin principal, y supervisores con permiso)
      const evs = allUsers.filter(u => 
        u.role === UserRole.ADMIN || 
        u.email === 'miguelreyesduran@gmail.com' || 
        (u.role === UserRole.SUPERVISOR && u.permissions?.canFillForms)
      );
      setAdmins(evs);
    }, (error) => {
      console.error("Error en el listener de usuarios:", error);
    });

    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'settings', 'config'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.weights) setWeights(data.weights);
      }
    };
    fetchConfig();

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, []);

  const handleCreateEvaluation = async () => {
    if (!selectedCollabId) return;
    setPendingCreation(true);
    const collab = collaborators.find(c => (c.uid === selectedCollabId || c.email === selectedCollabId));
    
    try {
      await addDoc(collection(db, 'evaluations'), {
        collaboratorId: collab?.uid || null,
        collaboratorEmail: collab?.email,
        collaboratorName: collab?.name || 'Usuario',
        area: collab?.area || 'Sin área',
        position: collab?.position || 'Sin cargo',
        status: EvaluationStatus.PENDING,
        responsibles,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        date: serverTimestamp(),
      });
      setShowAddModal(false);
      setSelectedCollabId('');
      setResponsibles({ prevencion: '', calidad: '', conducta: '', desempeno: '' });
    } catch (error: any) {
      console.error(error);
      handleFirestoreError(error, OperationType.CREATE, 'evaluations');
    } finally {
      setPendingCreation(false);
    }
  };

  const ALLOWED_DOMAINS = ['@gmail.com', '@maasspa.cl'];
  const isValidEmailDomain = (email: string) => {
    return ALLOWED_DOMAINS.some(domain => email.toLowerCase().endsWith(domain));
  };

  const [showDeleteModal, setShowDeleteModal] = useState<{ 
    type: 'evaluation' | 'collaborator', 
    id: string, 
    name: string 
  } | null>(null);

  const handleDeleteConfirmed = async () => {
    if (!showDeleteModal) return;
    
    try {
      if (showDeleteModal.type === 'evaluation') {
        console.log('Eliminando evaluación:', showDeleteModal.id);
        await deleteDoc(doc(db, 'evaluations', showDeleteModal.id));
        alert('Evaluación eliminada con éxito.');
      } else {
        console.log('Eliminando colaborador:', showDeleteModal.id);
        await deleteDoc(doc(db, 'users', showDeleteModal.id));
        alert('Colaborador eliminado correctamente.');
      }
    } catch (error: any) {
      console.error("Error en eliminación:", error);
      alert(`Error: ${error.message}`);
      handleFirestoreError(error, OperationType.DELETE, `${showDeleteModal.type}s/${showDeleteModal.id}`);
    } finally {
      setShowDeleteModal(null);
    }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImport(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n').filter(r => r.trim()).map(r => r.split(',').map(c => c.trim()));
      
      // Expected header: Nombre,Email,Area,Cargo,PrevencionEmail,CalidadEmail,ConductaEmail,DesempenoEmail
      const dataRows = rows.slice(1);
      
      for (const row of dataRows) {
        const [name, email, area, pos, pEmail, cEmail, coEmail, dEmail] = row;
        if (!email || !name) continue;

        if (!isValidEmailDomain(email)) {
          console.warn(`Email omitido por dominio no válido: ${email}`);
          continue;
        }

        try {
          // 1. Create/Update Collaborator
          const uRef = collection(db, 'users');
          const q = query(uRef, where('email', '==', email));
          const uSnap = await getDocs(q);
          
          if (uSnap.empty) {
            await addDoc(collection(db, 'users'), {
              name, email, area, position: pos, role: UserRole.COLABORADOR, createdAt: serverTimestamp(), isPreRegistered: true
            });
          }

          // 2. Create Evaluation
          await addDoc(collection(db, 'evaluations'), {
            collaboratorEmail: email,
            collaboratorName: name,
            area: area || 'Sin área',
            position: pos || 'Sin cargo',
            status: EvaluationStatus.PENDING,
            responsibles: {
              prevencion: (pEmail && isValidEmailDomain(pEmail)) ? pEmail : '',
              calidad: (cEmail && isValidEmailDomain(cEmail)) ? cEmail : '',
              conducta: (coEmail && isValidEmailDomain(coEmail)) ? coEmail : '',
              desempeno: (dEmail && isValidEmailDomain(dEmail)) ? dEmail : ''
            },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            date: serverTimestamp(),
          });
        } catch (err) {
          console.error("Error importing row:", row, err);
        }
      }
      setPendingImport(false);
      setShowImportModal(false);
    };
    reader.readAsText(file);
  };

  const exportData = (formatType: 'csv') => {
    const data = evaluations.map(e => ({
      ...e,
      date: e.date?.toDate?.()?.toISOString() || e.date,
      createdAt: e.createdAt?.toDate?.()?.toISOString() || e.createdAt,
      updatedAt: e.updatedAt?.toDate?.()?.toISOString() || e.updatedAt,
    }));

    const headers = ['ID', 'Colaborador', 'Área', 'Cargo', 'Estado', 'Puntaje', 'Fecha'];
    const csv = [
      headers.join(','),
      ...data.map(e => [
        e.id,
        e.collaboratorName,
        e.area,
        e.position,
        e.status,
        e.overallScore || 0,
        e.date
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evaluaciones_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const handleRegisterCollaborator = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;
    const area = formData.get('area') as string;
    const position = formData.get('position') as string;
    const password = formData.get('password') as string;

    if (!email || !name || ((registrationRole === UserRole.SUPERVISOR || registrationRole === UserRole.ADMIN) && !password)) {
      alert('Email, Nombre y Contraseña (para administradores/evaluadores) son obligatorios.');
      return;
    }

    if (!isValidEmailDomain(email)) {
      alert(`El correo debe terminar en @gmail.com o @maasspa.cl`);
      return;
    }

    const roleName = registrationRole === UserRole.ADMIN ? 'Administrador' : (registrationRole === UserRole.SUPERVISOR ? 'Evaluador' : 'Colaborador');
    setPendingReg(true);

    try {
      console.log('Iniciando registro para:', email);
      
      // 1. Check if user already exists in Firestore by email
      const q = query(collection(db, 'users'), where('email', '==', email));
      let snap;
      try {
        snap = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'users');
      }

      const existingUser = (snap && !snap.empty) ? { uid: snap.docs[0].id, ...snap.docs[0].data() } as UserProfile : null;

      let uid = existingUser?.uid || '';
      
      if (!existingUser) {
        // 2. Create Auth User (without logging out current admin)
        try {
          console.log('Creando usuario en Auth...');
          uid = await createNewUserWithPassword(email, password || 'Pasa123456');
          console.log('Usuario Auth creado con UID:', uid);
        } catch (err: any) {
          console.error('Error en Auth creation:', err);
          if (err.code === 'auth/email-already-in-use') {
            console.log('El correo ya existe en Auth, procederemos a vincular por email.');
          } else if (err.code === 'auth/operation-not-allowed') {
            console.warn('Registro de email/password deshabilitado. Creando solo registro en base de datos para login con Google.');
            // We use a random ID or the email as ID if we can't get a UID
            // But actually, it's better to use a temporary document and let the user take over
            uid = `pre-${Date.now()}`;
          } else {
            throw err;
          }
        }
      }

      // 3. Create or Update Firestore Doc
      if (uid) {
        console.log('Actualizando/Creando documento en Firestore para UID:', uid);
        const userDoc = {
          uid,
          email,
          name,
          area,
          position,
          role: registrationRole,
          permissions: registrationRole === UserRole.ADMIN ? {
            canFillForms: true,
            canViewDashboard: true,
            canViewEvaluationsList: true
          } : (registrationRole === UserRole.SUPERVISOR ? permissions : {
            canFillForms: true,
            canViewDashboard: false,
            canViewEvaluationsList: true
          }),
          createdAt: existingUser?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
          isPreRegistered: existingUser ? (existingUser.isPreRegistered ?? false) : false 
        };
        
        try {
          await setDoc(doc(db, 'users', uid), userDoc);
          console.log('Documento Firestore procesado exitosamente para:', roleName);
          setShowRegModal(false);
          alert(`¡ÉXITO! El ${roleName} ${name} ha sido ${existingUser ? 'actualizado' : 'registrado'} correctamente.\nEmail: ${email}\nContraseña: ${existingUser ? '(Existente)' : (password || 'Pasa123456')}`);
        } catch (err) {
          console.error('Error al guardar en Firestore:', err);
          handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
        }
      } else {
        throw new Error('No se pudo determinar el UID para el usuario.');
      }
    } catch (error: any) {
      console.error('Error completo en registro:', error);
      alert('Error en el proceso de registro: ' + (error.message || 'Error desconocido'));
    } finally {
      setPendingReg(false);
    }
  };

  const handleSaveWeights = async () => {
    const total = Object.values(weights).reduce((a: number, b: number) => a + b, 0);
    if (total !== 100) {
      alert("La suma de las ponderaciones debe ser exactamente 100%");
      return;
    }

    setIsSavingWeights(true);
    try {
      await setDoc(doc(db, 'settings', 'config'), {
        weights,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert("Configuración guardada exitosamente");
    } catch (error) {
      console.error(error);
      alert("Error al guardar configuración");
    } finally {
      setIsSavingWeights(false);
    }
  };

    const filteredEvaluations = (isAdmin 
      ? evaluations 
      : evaluations.filter(ev => 
          Object.values(ev.responsibles || {}).some(email => email === profile?.email) ||
          ev.collaboratorEmail === profile?.email ||
          ev.collaboratorId === profile?.uid
        )
    ).filter(ev => 
      ev.collaboratorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.collaboratorEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ev.area.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const stats = {
    total: filteredEvaluations.length,
    completed: filteredEvaluations.filter(e => e.status === EvaluationStatus.COMPLETED).length,
    pending: filteredEvaluations.filter(e => e.status === EvaluationStatus.PENDING).length,
    average: filteredEvaluations.filter(e => e.overallScore).reduce((acc, curr) => acc + (curr.overallScore || 0), 0) / (filteredEvaluations.filter(e => e.overallScore).length || 1)
  };

  const renderContent = () => {
    if (activeTab === 'evaluations') {
      return (
        <>
          {(isAdmin || profile?.permissions?.canViewDashboard) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Evaluaciones', value: stats.total, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', sub: '↑ 8% vs periodo ant.' },
                { label: 'Completadas', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Proceso al 75%' },
                { label: 'Promedio General', value: `${stats.average.toFixed(1)} / 5.0`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50', bar: (stats.average / 5) * 100 },
                { label: 'Pendientes Urgentes', value: stats.pending, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', sub: 'Requieren atención' },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
                      <p className="text-xl font-extrabold text-slate-900 mt-0.5">{stat.value}</p>
                    </div>
                    <div className={`${stat.bg} ${stat.color} p-2 rounded-lg`}>
                      <stat.icon size={18} />
                    </div>
                  </div>
                  {stat.bar ? (
                    <div className="h-1.5 w-full bg-slate-100 rounded-full mt-3 overflow-hidden">
                      <div className={`h-full ${stat.color.replace('text', 'bg')} w-[${stat.bar}%] text-white`} style={{ width: `${stat.bar}%` }} />
                    </div>
                  ) : (
                    <p className={`text-[9px] font-bold mt-2 ${stat.color}`}>{stat.sub}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {(isAdmin || profile?.permissions?.canViewEvaluationsList) && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  {isAdmin ? 'Registros de Período Reciente' : 'Mis Evaluaciones Pendientes'}
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">{filteredEvaluations.length}</span>
                </h2>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={12} />
                      <input 
                        type="text" 
                        placeholder="Buscar evaluaciones..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-1.5 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-lg text-xs transition-all w-64 ring-0 focus:ring-2 focus:ring-indigo-600/10"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-3">Colaborador / Cargo</th>
                      <th className="px-6 py-3">Área de Gestión</th>
                      <th className="px-6 py-3">Fecha Registro</th>
                      <th className="px-6 py-3 text-center">Desempeño</th>
                      <th className="px-6 py-3">Estado</th>
                      <th className="px-6 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEvaluations.map((ev) => (
                      <tr key={ev.id} className="group hover:bg-indigo-50/20 transition-colors">
                        <td className="px-6 py-3">
                          <div className="text-xs font-bold text-slate-900">{ev.collaboratorName}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <div className="text-[10px] text-slate-400 font-medium uppercase">{ev.position}</div>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${ev.templateType === 'staff' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {ev.templateType === 'staff' ? 'STAFF' : 'OPERATIVO'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="text-[11px] font-medium text-slate-600">{ev.area}</div>
                        </td>
                        <td className="px-6 py-3 text-[11px] text-slate-500 font-medium">
                          {ev.date?.toDate ? format(ev.date.toDate(), 'dd MMM, yyyy', { locale: es }) : 'Por asignar'}
                        </td>
                        <td className="px-6 py-3">
                          {ev.overallScore ? (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[11px] font-extrabold ${ev.overallScore >= 4 ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                  {ev.overallScore.toFixed(1)}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold">/ 5.0</span>
                              </div>
                              <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${ev.overallScore >= 4 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                  style={{ width: `${(ev.overallScore / 5) * 100}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-300 font-bold uppercase text-center">Sin Datos</div>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`badge-status ${
                            ev.status === EvaluationStatus.COMPLETED 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-amber-100 text-amber-700'
                          }`}>
                            {ev.status === EvaluationStatus.COMPLETED ? 'Finalizado' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(isAdmin || profile?.role === UserRole.ADMIN) && (
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Solicitando eliminar evaluación:', ev.id);
                                  setShowDeleteModal({
                                    type: 'evaluation',
                                    id: ev.id,
                                    name: `evaluación de ${ev.collaboratorName}`
                                  });
                                }}
                                className="inline-flex items-center px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black transition-all uppercase tracking-wider border border-rose-100 cursor-pointer"
                              >
                                Eliminar
                              </button>
                            )}
                            <button 
                              type="button"
                              onClick={() => navigate(`/evaluation/${ev.id}`)}
                              className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg text-[10px] font-black transition-all uppercase tracking-wider disabled:opacity-30 cursor-pointer"
                              disabled={(ev.status === EvaluationStatus.COMPLETED && !isAdmin) || (profile?.role === UserRole.SUPERVISOR && !profile?.permissions?.canFillForms)}
                            >
                              {ev.status === EvaluationStatus.COMPLETED ? 'Ver Resultado' : 'Evaluar'}
                            </button>
                            {isAdmin && (
                              <button 
                                type="button"
                                onClick={() => navigate(`/evaluation/${ev.id}?view=details`)}
                                className="inline-flex items-center px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white rounded-lg text-[10px] font-black transition-all uppercase tracking-wider cursor-pointer"
                              >
                                Detalles
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      );
    }

    if (activeTab === 'collaborators') {
      const filteredCollaborators = collaborators.filter(c => 
        c.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        c.area?.toLowerCase().includes(userSearchTerm.toLowerCase())
      );
      
      // Multi-role logic: Users can appear in multiple boxes
      const administrators = filteredCollaborators.filter(c => c.role === UserRole.ADMIN || c.email === 'miguelreyesduran@gmail.com');
      
      const supervisors = filteredCollaborators.filter(c => 
        c.role === UserRole.SUPERVISOR || 
        c.role === UserRole.ADMIN || 
        c.email === 'miguelreyesduran@gmail.com'
      );
      
      // Everyone is a collaborator (potential evaluatee)
      const simpleCollabs = filteredCollaborators;
      
      const otherUsers = filteredCollaborators.filter(c => 
        !c.role || (c.role !== UserRole.ADMIN && c.role !== UserRole.SUPERVISOR && c.role !== UserRole.COLABORADOR)
      );

      return (
        <div className="space-y-8">
          {/* Debug Panel for Admin Troubleshooting */}
          {isAdmin && (
            <div className="bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-700 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest">Panel de Diagnóstico (Sólo Admin)</h3>
                </div>
                <div className="text-[10px] font-mono text-slate-500">UID: {profile?.uid}</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                  <div className="text-[8px] font-bold text-slate-500 uppercase mb-1">Tu Rol</div>
                  <div className="text-xs font-mono font-bold text-emerald-400">{profile?.role || 'null'}</div>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                  <div className="text-[8px] font-bold text-slate-500 uppercase mb-1">Email Auth</div>
                  <div className="text-xs font-mono font-bold text-slate-300 truncate" title={profile?.email || ''}>{profile?.email || 'null'}</div>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                  <div className="text-[8px] font-bold text-slate-500 uppercase mb-1">Colaboradores</div>
                  <div className="text-xs font-mono font-bold text-slate-300">{collaborators.length} listados</div>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                  <div className="text-[8px] font-bold text-slate-500 uppercase mb-1">Evaluaciones</div>
                  <div className="text-xs font-mono font-bold text-slate-300">{evaluations.length} cargadas</div>
                </div>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center justify-between">
            <div className="relative group w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={14} />
              <input 
                type="text" 
                placeholder="Buscar colaboradores/evaluadores..." 
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-lg text-sm transition-all w-full ring-0 focus:ring-2 focus:ring-indigo-600/10"
              />
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Total: {filteredCollaborators.length}
            </div>
          </div>

          {administrators.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Administradores</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Acceso total al sistema</p>
                </div>
                <button 
                  onClick={() => {
                    setRegistrationRole(UserRole.ADMIN);
                    setShowRegModal(true);
                  }}
                  className="flex items-center gap-2 bg-indigo-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-slate-900 transition-all shadow-sm"
                >
                  <Plus size={12} />
                  Añadir Administrador
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                      <th className="px-6 py-3">Administrador</th>
                      <th className="px-6 py-3">Área / Cargo</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {administrators.map((col) => (
                      <tr key={col.uid} className="group hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3">
                          <div className="text-xs font-bold text-slate-900">{col.name}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{col.email}</div>
                        </td>
                        <td className="px-6 py-3 text-[11px] font-semibold text-slate-600">
                          {col.area} | {col.position}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setEditingCollab(col)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Editar Perfil"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('Solicitando eliminar colaborador:', col.email);
                                setShowDeleteModal({
                                  type: 'collaborator',
                                  id: col.uid,
                                  name: col.name
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Eliminar Usuario"
                            >
                              <Trash2 size={14} className="pointer-events-none" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {otherUsers.length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm flex flex-col">
              <div className="p-4 border-b border-amber-100">
                <h2 className="text-sm font-bold text-amber-900 uppercase tracking-widest">Usuarios con Rol no Definido</h2>
                <p className="text-[10px] text-amber-700 font-bold uppercase tracking-tight">Estos usuarios requieren asignación manual de rol para acceso correcto</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-amber-100/50 text-[10px] font-bold text-amber-700 uppercase tracking-widest border-b border-amber-100">
                      <th className="px-6 py-3">Usuario</th>
                      <th className="px-6 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {otherUsers.map((col) => (
                      <tr key={col.uid} className="group hover:bg-amber-100/30 transition-colors">
                        <td className="px-6 py-3">
                          <div className="text-xs font-bold text-amber-900">{col.name || 'Sin nombre'}</div>
                          <div className="text-[10px] text-amber-700 font-medium">{col.email}</div>
                        </td>
                        <td className="px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setEditingCollab(col)}
                              className="p-1.5 text-amber-600 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                              title="Asignar Rol"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('Solicitando eliminar usuario:', col.email);
                                setShowDeleteModal({
                                  type: 'collaborator',
                                  id: col.uid,
                                  name: col.name || col.email
                                });
                              }}
                              className="p-1.5 text-amber-600 hover:text-rose-600 hover:bg-white rounded-lg transition-all cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 size={14} className="pointer-events-none" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Gestión de Evaluadores / Supervisores</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Define los permisos de acceso para cada evaluador</p>
              </div>
              <button 
                onClick={() => {
                  setRegistrationRole(UserRole.SUPERVISOR);
                  setShowRegModal(true);
                }}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                <Plus size={12} />
                Añadir Evaluador
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-3">Evaluador</th>
                    <th className="px-6 py-3 text-center">Formulario</th>
                    <th className="px-6 py-3 text-center">Dashboard</th>
                    <th className="px-6 py-3 text-center">Mi Lista</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {supervisors.map((col) => (
                    <tr key={col.uid} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="text-xs font-bold text-slate-900">{col.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{col.email}</div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={col.permissions?.canFillForms} 
                          onChange={async (e) => {
                            try {
                              await updateDoc(doc(db, 'users', col.uid), {
                                'permissions.canFillForms': e.target.checked
                              });
                            } catch (err) {
                              console.error("Error updating permissions:", err);
                              handleFirestoreError(err, OperationType.UPDATE, `users/${col.uid}`);
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={col.permissions?.canViewDashboard} 
                          onChange={async (e) => {
                            await updateDoc(doc(db, 'users', col.uid), {
                              'permissions.canViewDashboard': e.target.checked
                            });
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={col.permissions?.canViewEvaluationsList} 
                          onChange={async (e) => {
                            await updateDoc(doc(db, 'users', col.uid), {
                              'permissions.canViewEvaluationsList': e.target.checked
                            });
                          }}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            type="button"
                            onClick={() => setEditingCollab(col)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                            title="Editar Perfil"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Solicitando eliminar supervisor:', col.email);
                              setShowDeleteModal({
                                type: 'collaborator',
                                id: col.uid,
                                name: col.name
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Eliminar Usuario"
                          >
                            <Trash2 size={14} className="pointer-events-none" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Colaboradores</h2>
              <button 
                onClick={() => {
                  setRegistrationRole(UserRole.COLABORADOR);
                  setShowRegModal(true);
                }}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-all shadow-sm"
              >
                <Plus size={12} />
                Añadir Colaborador
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100">
                    <th className="px-6 py-3">Nombre / Email</th>
                    <th className="px-6 py-3">Área / Cargo</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {simpleCollabs.map((col) => (
                    <tr key={col.uid} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="text-xs font-bold text-slate-900">{col.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{col.email}</div>
                      </td>
                      <td className="px-6 py-3 text-[11px] font-semibold text-slate-600">
                        {col.area} | {col.position}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            type="button"
                            onClick={() => setEditingCollab(col)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                            title="Editar Perfil"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              console.log('Solicitando eliminar colaborador:', col.email);
                              setShowDeleteModal({
                                type: 'collaborator',
                                id: col.uid,
                                name: col.name
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="Eliminar Usuario"
                          >
                            <Trash2 size={14} className="pointer-events-none" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'settings') {
      const total = Object.values(weights).reduce((a: number, b: number) => a + b, 0);
      return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-w-2xl">
          <div className="bg-slate-900 p-8 text-white">
            <h2 className="text-lg font-black uppercase tracking-widest mb-1">Configuración de Ponderación</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Define el peso porcentual de cada pilar de evaluación</p>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 gap-6">
              {[
                { id: 'prevencion', label: 'Prevención / Seguridad', icon: Clock },
                { id: 'calidad', label: 'Calidad Técnica', icon: CheckCircle2 },
                { id: 'conducta', label: 'Conducta y Ética', icon: Users },
                { id: 'desempeno', label: 'Desempeño y Objetivos', icon: TrendingUp },
              ].map((item) => (
                <div key={item.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                        <item.icon size={16} />
                      </div>
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={weights[item.id as keyof typeof weights]} 
                        onChange={(e) => setWeights({ ...weights, [item.id]: parseInt(e.target.value) || 0 })}
                        className="w-16 bg-slate-50 border-slate-200 rounded-lg px-2 py-1 text-xs font-black text-center outline-none focus:border-indigo-600"
                      />
                      <span className="text-xs font-black text-slate-400">%</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all" 
                      style={{ width: `${weights[item.id as keyof typeof weights]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className={`mt-8 p-4 rounded-xl flex items-center justify-between ${total === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest">Total Ponderado</p>
                <p className="text-2xl font-black">{total}%</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase max-w-[150px]">
                  {total === 100 ? 'Configuración válida para cálculo de bono.' : 'La suma debe ser exactamente 100%'}
                </p>
              </div>
            </div>

            <button
              disabled={isSavingWeights || total !== 100}
              onClick={handleSaveWeights}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSavingWeights ? 'Guardando...' : 'Aplicar Nueva Configuración'}
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="mb-8 p-10 bg-indigo-600 rounded-[2.5rem] text-white overflow-hidden relative shadow-2xl shadow-indigo-600/20">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-indigo-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-100 mb-6 backdrop-blur-md">
            <TrendingUp size={12} />
            Sistema de Gestión Activo
          </div>
          <h1 className="text-4xl font-black tracking-tighter mb-4 leading-[0.9]">
            Bienvenido, <br/>
            <span className="text-indigo-200">{profile?.name}</span>
          </h1>
          <p className="text-sm font-medium text-indigo-100/70 max-w-sm leading-relaxed">
            Monitorea el desempeño, gestiona protocolos de evaluación y analiza resultados en tiempo real.
          </p>
        </div>
        <div className="absolute right-0 top-0 w-1/2 h-full hidden lg:block">
          <div className="absolute right-10 top-1/2 -translate-y-1/2 grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`w-32 h-32 rounded-3xl backdrop-blur-xl border border-white/10 ${i % 2 === 0 ? 'bg-white/5 mt-8' : 'bg-white/20'}`} />
            ))}
          </div>
        </div>
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none mb-1">Global Dashboard</h1>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Análisis de Desempeño Corporativo</p>
          </div>

          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setActiveTab('evaluations')}
              className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'evaluations' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Evaluaciones
            </button>
            {isAdmin && (
              <>
                <button 
                  onClick={() => setActiveTab('collaborators')}
                  className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'collaborators' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Colaboradores
                </button>
                <button 
                  onClick={() => setActiveTab('settings')}
                  className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Ponderación
                </button>
              </>
            )}
          </div>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
              <button onClick={() => exportData('csv')} className="px-4 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 rounded-md transition-colors flex items-center gap-2">
                <Download size={12} /> Descargar CSV
              </button>
            </div>
            
            <button 
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
            >
              <Download size={14} className="rotate-180" />
              Importar CSV
            </button>

            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20"
            >
              <Plus size={14} />
              Nueva Evaluación
            </button>
          </div>
        )}
      </div>

      {renderContent()}

      {showRegModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Registrar Nuevo {registrationRole === UserRole.ADMIN ? 'Administrador' : (registrationRole === UserRole.SUPERVISOR ? 'Evaluador' : 'Colaborador')}
            </h3>
            <p className="text-xs text-slate-500 font-medium mb-6">El sistema reconocerá automáticamente a este usuario cuando inicie sesión por primera vez con su email.</p>
            
            <form onSubmit={handleRegisterCollaborator} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nombre Completo</label>
                  <input name="name" required type="text" className="w-full bg-slate-50 border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none focus:border-indigo-600 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email</label>
                  <input name="email" required type="email" className="w-full bg-slate-50 border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none focus:border-indigo-600 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Área / Depto</label>
                  <input name="area" type="text" className="w-full bg-slate-50 border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none focus:border-indigo-600 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Cargo</label>
                  <input name="position" type="text" className="w-full bg-slate-50 border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none focus:border-indigo-600 transition-all" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Contraseña de Acceso</label>
                <input name="password" required={registrationRole === UserRole.SUPERVISOR || registrationRole === UserRole.ADMIN} type="text" placeholder="Mínimo 6 caracteres" className="w-full bg-slate-50 border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none focus:border-indigo-600 transition-all font-mono" />
              </div>

              {registrationRole === UserRole.SUPERVISOR && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Permisos de Acceso (Evaluador)</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={permissions.canFillForms}
                        onChange={(e) => setPermissions(prev => ({ ...prev, canFillForms: e.target.checked }))}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" 
                      />
                      <span className="text-[11px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Acceso a Formulario de Evaluación</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={permissions.canViewDashboard}
                        onChange={(e) => setPermissions(prev => ({ ...prev, canViewDashboard: e.target.checked }))}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" 
                      />
                      <span className="text-[11px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Visualizar Dashboard Administrativo</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={permissions.canViewEvaluationsList}
                        onChange={(e) => setPermissions(prev => ({ ...prev, canViewEvaluationsList: e.target.checked }))}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" 
                      />
                      <span className="text-[11px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Ver Lista de Colaboradores Asignados</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4">
                <button type="button" onClick={() => setShowRegModal(false)} className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all uppercase tracking-widest">
                  Cancelar
                </button>
                <button 
                  disabled={pendingReg} 
                  className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {pendingReg ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Confirmar Registro'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {editingCollab && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Editar Colaborador</h3>
            <p className="text-xs text-slate-500 font-medium mb-6">Actualiza la ficha técnica de {editingCollab.name}.</p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Área / Departamento</label>
                <input 
                  type="text" 
                  defaultValue={editingCollab.area}
                  placeholder="Ej: Operaciones, Ingeniería..."
                  id="editArea"
                  className="w-full bg-slate-50 border-slate-200 rounded-lg px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Cargo / Título</label>
                <input 
                  type="text" 
                  defaultValue={editingCollab.position}
                  placeholder="Ej: Supervisor, Analista..."
                  id="editPos"
                  className="w-full bg-slate-50 border-slate-200 rounded-lg px-4 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600"
                />
              </div>

              {editingCollab.role === UserRole.SUPERVISOR && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Permisos de Acceso</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        defaultChecked={editingCollab.permissions?.canFillForms}
                        id="editCanFill"
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" 
                      />
                      <span className="text-[11px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Acceso a Formulario</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        defaultChecked={editingCollab.permissions?.canViewDashboard}
                        id="editCanDash"
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" 
                      />
                      <span className="text-[11px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Ver Dashboard</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        defaultChecked={editingCollab.permissions?.canViewEvaluationsList}
                        id="editCanList"
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" 
                      />
                      <span className="text-[11px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Ver Lista Asignada</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setEditingCollab(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  const area = (document.getElementById('editArea') as HTMLInputElement).value;
                  const pos = (document.getElementById('editPos') as HTMLInputElement).value;
                  
                  const updateData: any = {
                    area, 
                    position: pos, 
                    updatedAt: serverTimestamp()
                  };

                  if (editingCollab.role === UserRole.SUPERVISOR) {
                    updateData.permissions = {
                      canFillForms: (document.getElementById('editCanFill') as HTMLInputElement).checked,
                      canViewDashboard: (document.getElementById('editCanDash') as HTMLInputElement).checked,
                      canViewEvaluationsList: (document.getElementById('editCanList') as HTMLInputElement).checked,
                    };
                  }

                  try {
                    await updateDoc(doc(db, 'users', editingCollab.uid), updateData);
                    setEditingCollab(null);
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-600/20"
              >
                Guardar Cambios
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Importación Masiva</h3>
            <p className="text-xs text-slate-500 font-medium mb-6">Sube un archivo CSV con el formato:<br/>
              <code className="bg-slate-100 p-1 rounded text-[10px] block mt-2">
                Nombre,Email,Area,Cargo,Eva_Prevencion,Eva_Calidad,Eva_Conducta,Eva_Desempeno
              </code>
            </p>
            
            <div className="space-y-4 mb-8">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleCSVImport}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Download size={24} className="mx-auto text-slate-300 mb-2 rotate-180" />
                <p className="text-xs font-bold text-slate-500">{pendingImport ? 'Procesando archivo...' : 'Haz click o arrastra tu CSV'}</p>
              </div>
            </div>

            <button 
              onClick={() => setShowImportModal(false)}
              className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
            >
              Cerrar
            </button>
          </motion.div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh]"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-1">Nueva Asignación Multi-fuente</h3>
            <p className="text-xs text-slate-500 font-medium mb-6">Define los responsables de cada área para este colaborador.</p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Colaborador Evaluado</label>
                <select 
                  value={selectedCollabId}
                  onChange={(e) => setSelectedCollabId(e.target.value)}
                  className="w-full bg-slate-50 border-slate-200 rounded-lg px-4 py-2.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 outline-none transition-all"
                >
                  <option value="">Seleccionar...</option>
                  {collaborators.map(c => (
                    <option key={c.uid || c.email} value={c.uid || c.email}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'prevencion', label: 'Evaluador Prevención' },
                  { id: 'calidad', label: 'Evaluador Calidad' },
                  { id: 'conducta', label: 'Evaluador Conducta' },
                  { id: 'desempeno', label: 'Evaluador Desempeño' },
                ].map((item) => (
                  <div key={item.id}>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{item.label}</label>
                    <select 
                      value={responsibles[item.id as keyof typeof responsibles]}
                      onChange={(e) => setResponsibles({ ...responsibles, [item.id]: e.target.value })}
                      className="w-full bg-slate-50 border-slate-200 rounded-lg px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-600 transition-all"
                    >
                      <option value="">Cualquier Admin/Evaluador</option>
                      {admins.map(a => (
                        <option key={a.uid || a.email} value={a.email}>{a.name} ({a.role === UserRole.ADMIN ? 'Admin' : 'Evaluador'})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button 
                disabled={!selectedCollabId || pendingCreation}
                onClick={handleCreateEvaluation}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
              >
                {pendingCreation ? 'Procesando...' : 'Asignar Protocolo'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl border border-slate-200 text-center"
          >
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 leading-none uppercase tracking-tighter">
              ¿Confirmar Eliminación?
            </h3>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed px-4">
              ¿Está seguro que desea eliminar {showDeleteModal.type === 'evaluation' ? 'esta evaluación' : 'a este colaborador'}? <br/>
              <span className="font-bold text-slate-900">"{showDeleteModal.name}"</span>
              <br/>Esta acción no se puede deshacer.
            </p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteConfirmed}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-rose-600/20"
              >
                Sí, Eliminar Permanentemente
              </button>
              <button 
                onClick={() => setShowDeleteModal(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 rounded-2xl text-xs uppercase tracking-widest transition-all"
              >
                No, Mantener Registro
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
