export enum UserRole {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  COLABORADOR = 'colaborador',
}

export interface UserPermissions {
  canFillForms: boolean;
  canViewDashboard: boolean;
  canViewEvaluationsList: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  area?: string;
  position?: string;
  permissions?: UserPermissions;
  createdAt: any;
  updatedAt?: any;
  isPreRegistered?: boolean;
}

export enum EvaluationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

export interface EvaluationMetrics {
  prevencion?: {
    epp?: number;
    cultura?: number;
    reportabilidad?: number;
    orden?: number;
    incidentes?: 'sin' | 'leve' | 'normal' | 'grave';
  };
  calidad?: {
    procedimiento?: number;
    estandares?: number;
    noConformidades?: number;
    clasificacionNoConformidades?: 'sin' | 'leve' | 'normal' | 'grave';
  };
  conducta?: {
    puntualidad?: number;
    respeto?: number;
    salida?: number;
  };
  desempeno?: {
    perfil?: number;
    avance?: '100' | '90' | '80' | 'lower';
    instrucciones?: number;
    interes?: number;
  };
}

export interface AppConfig {
  weights: {
    prevencion: number;
    calidad: number;
    conducta: number;
    desempeno: number;
  };
}

export interface MetricResponsibles {
  prevencion?: string; // Email of assigned reviewer
  calidad?: string;
  conducta?: string;
  desempeno?: string;
}

export interface Evaluation {
  id: string;
  collaboratorId: string | null;
  collaboratorEmail?: string;
  collaboratorName: string;
  area: string;
  position: string;
  status: EvaluationStatus;
  metrics?: EvaluationMetrics;
  responsibles?: MetricResponsibles;
  comments?: string;
  aiFeedback?: string;
  aiManagementFeedback?: string;
  overallScore?: number;
  date: any;
  createdAt: any;
  updatedAt: any;
  templateType?: 'staff' | 'operativo';
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}
