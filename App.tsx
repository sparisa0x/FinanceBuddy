import React, { useState, useEffect, useCallback } from 'react';
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
import { LandingPage } from './components/LandingPage';
import { Preloader } from './components/Preloader';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

// ─── Hash-based routing helpers ───────────────────────────────────────────────
const VALID_TABS = [
  'dashboard', 'income-expense', 'debts', 'investments', 'wishlist',
  'calendar', 'history', 'analytics', 'profile', 'import', 'admin',
] as const;

type Tab = (typeof VALID_TABS)[number];

/** Read the current hash (e.g. "#/dashboard") and return the slug */
function readHash(): string {
  return (window.location.hash.replace(/^#\/?/, '').toLowerCase()) || '';
}

/** Set the hash without triggering a full page reload */
function setHash(slug: string) {
  window.history.replaceState(null, '', `#/${slug}`);
}

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
  const [activeTab, setActiveTabState] = useState<string>('dashboard');
  const [publicView, setPublicView] = useState<'landing' | 'auth'>('landing');
  const [showPreloader, setShowPreloader] = useState(true);

  // Wrap setActiveTab to also update the URL hash
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    setHash(tab);
  }, []);

  // On mount: read hash to restore tab or public view
  useEffect(() => {
    const hash = readHash();
    if (VALID_TABS.includes(hash as Tab)) {
      setActiveTabState(hash);
    } else if (hash === 'login') {
      setPublicView('auth');
    }
  }, []);

  // Listen for browser back/forward hash changes
  useEffect(() => {
    const onHashChange = () => {
      const hash = readHash();
      if (isAuthenticated && VALID_TABS.includes(hash as Tab)) {
        setActiveTabState(hash);
      } else if (!isAuthenticated) {
        if (hash === 'login') setPublicView('auth');
        else setPublicView('landing');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [isAuthenticated]);

  // Preloader
  useEffect(() => {
    const timer = setTimeout(() => setShowPreloader(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // On login: restore the hash tab or default to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      const hash = readHash();
      if (VALID_TABS.includes(hash as Tab)) {
        setActiveTabState(hash);
      } else {
        setActiveTabState('dashboard');
        setHash('dashboard');
      }
    }
  }, [isAuthenticated]);

  // When not authenticated, set hash to login or clear
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (publicView === 'auth') {
        setHash('login');
      } else {
        setHash('');
      }
    }
  }, [isAuthenticated, isLoading, publicView]);

  if (showPreloader) {
    return <Preloader />;
  }

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
    if (publicView === 'landing') {
      return (
        <LandingPage
          onGetStarted={() => { setPublicView('auth'); setHash('login'); }}
          onSignIn={() => { setPublicView('auth'); setHash('login'); }}
        />
      );
    }
    return <Login onBackHome={() => { setPublicView('landing'); setHash(''); }} />;
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
    <>
      <FinanceProvider>
        <AppContent />
      </FinanceProvider>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;