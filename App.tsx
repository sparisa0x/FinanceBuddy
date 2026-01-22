import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { IncomeExpense } from './components/IncomeExpense';
import { DebtManager } from './components/DebtManager';
import { Investments } from './components/Investments';
import { Wishlist } from './components/Wishlist';
import { CalendarView } from './components/CalendarView';
import { FinancialArchives } from './components/FinancialArchives';
import { Login } from './components/Login';
import { Upload, FileText } from 'lucide-react';

// Simulated Import Component since it's simple
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

// Placeholder for Deep Analytics
const AnalyticsView = () => (
   <div className="flex flex-col items-center justify-center h-96">
      <FileText className="h-12 w-12 text-slate-300 mb-4" />
      <p className="text-slate-500">Deep Analytics reports generated from monthly data will appear here.</p>
   </div>
);

// Child component to consume context and decide view
const AppContent: React.FC = () => {
  const { isAuthenticated } = useFinance();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!isAuthenticated) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'calendar': return <CalendarView />;
      case 'history': return <FinancialArchives />;
      case 'income-expense': return <IncomeExpense />;
      case 'debts': return <DebtManager />;
      case 'investments': return <Investments />;
      case 'wishlist': return <Wishlist />;
      case 'import': return <ImportView />;
      case 'analytics': return <AnalyticsView />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
};

export default App;
