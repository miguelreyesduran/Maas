/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserRole } from './types';
import Navbar from './components/Navbar';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import CollaboratorDashboard from './components/CollaboratorDashboard';
import EvaluationForm from './components/EvaluationForm';
import Sidebar from './components/Sidebar';

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-xl" />
          <div className="text-sm font-medium text-gray-400">Iniciando sistema...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-8">
          <Routes>
            <Route path="/" element={
              (profile?.role === UserRole.ADMIN || profile?.role === UserRole.SUPERVISOR)
              ? <AdminDashboard initialTab="evaluations" /> 
              : <CollaboratorDashboard />
            } />
            <Route path="/evaluations" element={
              (profile?.role === UserRole.ADMIN || profile?.role === UserRole.SUPERVISOR)
              ? <AdminDashboard initialTab="evaluations" /> 
              : <CollaboratorDashboard />
            } />
            <Route path="/collaborators" element={
              (profile?.role === UserRole.ADMIN || profile?.role === UserRole.SUPERVISOR)
              ? <AdminDashboard initialTab="collaborators" /> 
              : <Navigate to="/" />
            } />
            <Route path="/evaluation/:id" element={<EvaluationForm />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
