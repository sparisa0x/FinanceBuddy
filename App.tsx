import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { FinanceProvider } from './context/FinanceContext';
import ProtectedRoute from './components/ProtectedRoute';
import { Login } from './components/Login';
import Register from './components/Register';
import VerifyOtp from './components/VerifyOtp';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { IncomeExpense } from './components/IncomeExpense';
import { DebtManager } from './components/DebtManager';
import { Investments } from './components/Investments';
import { Wishlist } from './components/Wishlist';
import { CalendarView } from './components/CalendarView';
import { FinancialArchives } from './components/FinancialArchives';
import { Profile } from './components/Profile';
import { AdminPanel } from './components/AdminPanel';
import { ExportData } from './components/ExportData';
import { OfflineBanner } from './components/OfflineBanner';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { FileText } from 'lucide-react';

const AnalyticsView = () => (
  <div className="flex flex-col items-center justify-center h-96 text-slate-500">
    <FileText className="h-16 w-16 text-slate-300 mb-4" />
    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Deep Analytics</h3>
    <p className="mt-2 text-center max-w-sm">Advanced AI-powered financial forecasting coming soon.</p>
  </div>
);

// Main authenticated app — keeps the existing tab-based layout
const AppMain: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="animate-fade-in">
        {activeTab === 'dashboard'      && <Dashboard />}
        {activeTab === 'income-expense' && <IncomeExpense />}
        {activeTab === 'debts'          && <DebtManager />}
        {activeTab === 'investments'    && <Investments />}
        {activeTab === 'wishlist'       && <Wishlist />}
        {activeTab === 'calendar'       && <CalendarView />}
        {activeTab === 'history'        && <FinancialArchives />}
        {activeTab === 'analytics'      && <AnalyticsView />}
        {activeTab === 'profile'        && <Profile />}
        {activeTab === 'admin'          && <AdminPanel />}
        {activeTab === 'export'          && <ExportData />}
      </div>
    </Layout>
  );
};

function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-amber-500/40 bg-slate-900 p-6">
          <h1 className="text-xl font-semibold text-amber-300">App configuration missing</h1>
          <p className="mt-3 text-sm text-slate-300">
            Set <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> in your deployment environment.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Vercel → Project Settings → Environment Variables, then redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <FinanceProvider>
          <OfflineBanner />
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
              success: { iconTheme: { primary: '#6366f1', secondary: '#f1f5f9' } }
            }}
          />
          <Routes>
            {/* Public routes */}
            <Route path="/login"      element={<Login />} />
            <Route path="/register"   element={<Register />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Protected app */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppMain />
                </ProtectedRoute>
              }
            />
          </Routes>
        </FinanceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;