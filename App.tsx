import React, { useState, useEffect } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { IncomeExpense } from './components/IncomeExpense';
import { DebtManager } from './components/DebtManager';
import { Investments } from './components/Investments';
import { Wishlist } from './components/Wishlist';
import { CalendarView } from './components/CalendarView';
import { FinancialArchives } from './components/FinancialArchives';
import { Profile } from './components/Profile';
import { Login } from './components/Login';
import { AdminPanel } from './components/AdminPanel';
import { Upload, FileText, Loader2 } from 'lucide-react';

const ImportView = () => (
  <div className="flex flex-col items-center justify-center h-96 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50">
    <div className="rounded-full bg-indigo-50 p-6 dark:bg-indigo-900/20 mb-4">
      <Upload className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
    </div>
    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Upload Bank Statement</h3>
    <p className="mt-2 text-slate-500 max-w-sm text-center">Drag and drop your PDF or CSV bank statement here. We'll use Gemini AI to automatically extract your income and expenses.</p>
    <button className="mt-6 rounded-lg bg-indigo-600 px-6 py-2.5 font-semibold text-white hover:bg-indigo-700 shadow-md">
      Select File
    </button>
  </div>
);

const AnalyticsView = () => (
   <div className="flex flex-col items-center justify-center h-96 text-slate-500">
      <FileText className="h-16 w-16 text-slate-300 mb-4" />
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Deep Analytics</h3>
      <p className="mt-2 text-center max-w-sm">
        Advanced AI-powered financial forecasting and anomaly detection coming soon.
      </p>
   </div>
);

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useFinance();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
          <p className="text-slate-500 font-medium animate-pulse">Syncing your financial data...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="animate-fade-in">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'income-expense' && <IncomeExpense />}
        {activeTab === 'debts' && <DebtManager />}
        {activeTab === 'investments' && <Investments />}
        {activeTab === 'wishlist' && <Wishlist />}
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'history' && <FinancialArchives />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'profile' && <Profile />}
        {activeTab === 'import' && <ImportView />}
        {activeTab === 'admin' && <AdminPanel />}
      </div>
    </Layout>
  );
};

function App() {
  return (
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
}

export default App;