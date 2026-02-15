import React, { useState } from 'react';
import { MENU_ITEMS } from '../constants';
import { Moon, Sun, Menu, X, LogOut, User } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (id: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('finance_theme');
    return saved ? saved === 'dark' : true; // default dark
  });
  const { userName, logout, isAdmin } = useFinance();

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('finance_theme', newMode ? 'dark' : 'light');
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 lg:relative lg:translate-x-0 flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center border-b border-slate-200 px-6 dark:border-slate-800 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 mr-3"></div>
          <span className="text-lg font-bold text-slate-900 dark:text-white">FinanceBuddy</span>
          <button 
            type="button"
            className="ml-auto lg:hidden text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="space-y-1 p-4 flex-1 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
             // Admin check
             if ((item as any).adminOnly && !isAdmin) return null;

             const Icon = item.icon;
             const isActive = activeTab === item.id;
             return (
               <button
                 key={item.id}
                 type="button"
                 onClick={() => {
                   setActiveTab(item.id);
                   setIsSidebarOpen(false);
                 }}
                 className={`flex w-full items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                   isActive 
                   ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' 
                   : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                 }`}
               >
                 <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                 {item.label}
               </button>
             );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
           <button 
             type="button"
             onClick={handleLogout}
             className="flex w-full items-center px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors cursor-pointer"
           >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900 shrink-0">
          <button 
            type="button"
            className="rounded-md p-2 text-slate-500 lg:hidden hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex items-center gap-4 ml-auto">
            <button 
              type="button"
              onClick={toggleTheme}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            
            <button 
              type="button"
              onClick={handleLogout}
              className="hidden md:flex rounded-full p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-l border-slate-200 pl-4 dark:border-slate-800">
               <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{userName}</p>
                  <p className="text-xs text-slate-500">{isAdmin ? 'Administrator' : 'Premium Plan'}</p>
               </div>
               <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <User className="h-5 w-5 text-slate-500 dark:text-slate-400" />
               </div>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6 dark:bg-slate-950">
           <div className="mx-auto max-w-7xl">
              {children}
           </div>
        </main>
      </div>
    </div>
  );
};