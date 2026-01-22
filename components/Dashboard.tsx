import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, ShieldAlert, DollarSign, Edit2, Save, X, ShoppingBag } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { netWorth, totalDebt, healthScore, transactions, currency, userName, setUserName, creditScores, updateCreditScores, wishlist } = useFinance();
  
  // Local state for name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);

  // Local state for credit score editing
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [tempScores, setTempScores] = useState(creditScores);

  const handleSaveName = () => {
    if (tempName.trim()) {
      setUserName(tempName);
      setIsEditingName(false);
    }
  };

  const handleSaveScores = (e: React.FormEvent) => {
    e.preventDefault();
    updateCreditScores(tempScores);
    setIsScoreModalOpen(false);
  };

  const income = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);

  // Mock Trend Data for Charts
  const trendData = [
    { name: 'Jan', worth: netWorth * 0.8 },
    { name: 'Feb', worth: netWorth * 0.85 },
    { name: 'Mar', worth: netWorth * 0.9 },
    { name: 'Apr', worth: netWorth * 0.92 },
    { name: 'May', worth: netWorth },
  ];

  const StatCard = ({ title, value, subValue, type }: any) => {
    const isGood = type === 'good';
    const isBad = type === 'bad';
    return (
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wide">{title}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{currency}{value.toLocaleString()}</span>
          {subValue && (
            <span className={`text-sm font-medium flex items-center ${isGood ? 'text-emerald-500' : isBad ? 'text-rose-500' : 'text-slate-500'}`}>
              {isGood ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
              {subValue}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Helper for credit score color
  const getScoreColor = (score: number) => {
    if (score >= 750) return '#10b981'; // Emerald
    if (score >= 650) return '#f59e0b'; // Amber
    return '#f43f5e'; // Rose
  };

  const getScoreGlow = (score: number) => {
    const color = getScoreColor(score);
    return `0 0 15px ${color}66`; // 66 for opacity
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Welcome & Name Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={tempName} 
                  onChange={(e) => setTempName(e.target.value)}
                  className="text-2xl font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <button 
                  onClick={handleSaveName} 
                  className="p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 transition-colors"
                  title="Save Name"
                >
                  <Save className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Welcome back, {userName}
                <button 
                  onClick={() => { setTempName(userName); setIsEditingName(true); }} 
                  className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1"
                  title="Edit Name"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
              </h1>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Here's your financial overview for {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.</p>
        </div>
        <div className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg text-center md:text-right">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Health Score Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold">Financial Health Score</h1>
            <p className="mt-2 text-slate-300">Based on your savings, debt, and investments.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 backdrop-blur">
              <span className={`text-3xl font-bold`} style={{ color: healthScore.color }}>{healthScore.score}</span>
              <Activity className="absolute -top-1 -right-1 h-6 w-6 text-emerald-400" />
            </div>
            <div className="text-left">
              <div className="text-lg font-bold" style={{ color: healthScore.color }}>{healthScore.status}</div>
              <div className="text-sm text-slate-400">Keep it up!</div>
            </div>
          </div>
        </div>
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Net Worth" value={netWorth} subValue="+12% vs last year" type="good" />
        <StatCard title="Total Debt" value={totalDebt} subValue="-5% repayment" type="bad" />
        <StatCard title="Total Income" value={income} subValue="This Month" type="neutral" />
        <StatCard title="Total Expenses" value={expense} subValue="High spending" type="bad" />
      </div>

      {/* Main Content Grid: Chart & Side Panel */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 space-y-6">
           <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="mb-6 text-lg font-semibold text-slate-900 dark:text-white">Net Worth Trend</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorWorth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${currency}${value/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} 
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => `${currency}${value.toLocaleString()}`}
                  />
                  <Area type="monotone" dataKey="worth" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorWorth)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Wishlist Quick View */}
          <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                   <ShoppingBag className="w-5 h-5 text-indigo-500" />
                   Wishlist Needs
                </h3>
                <span className="text-xs text-slate-500">Based on priority</span>
             </div>
             
             {wishlist.filter(w => w.status !== 'purchased').length > 0 ? (
               <div className="grid gap-4 sm:grid-cols-2">
                 {wishlist.filter(w => w.status !== 'purchased').slice(0, 4).map(item => {
                    const progress = Math.min(100, (netWorth * 0.1 / item.estimatedCost) * 100);
                    return (
                       <div key={item.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                             <div>
                               <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{item.name}</p>
                               <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${item.category === 'need' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                 {item.category}
                               </span>
                             </div>
                             <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{currency}{item.estimatedCost.toLocaleString()}</p>
                          </div>
                          <div className="mt-1">
                             <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                               <span>Affordability</span>
                               <span>{Math.round(progress)}%</span>
                             </div>
                             <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                             </div>
                          </div>
                       </div>
                    );
                 })}
               </div>
             ) : (
                <p className="text-sm text-slate-500 italic">Your wishlist is empty. Add items to track goals!</p>
             )}
          </div>
        </div>

        {/* Side Panel: Credit & Insights */}
        <div className="space-y-6">
          
          {/* Credit Score Card */}
          <div 
            onClick={() => { setTempScores(creditScores); setIsScoreModalOpen(true); }}
            className="group relative cursor-pointer overflow-hidden rounded-xl bg-slate-900 p-6 shadow-lg transition-transform hover:-translate-y-1"
          >
             {/* Abstract Glow Background */}
             <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-indigo-500/20 blur-3xl group-hover:bg-indigo-500/30 transition-all"></div>
             
             <div className="flex justify-between items-start mb-6 relative z-10">
                <h3 className="text-lg font-bold text-white">Credit Profile</h3>
                <Edit2 className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
             </div>

             <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="flex flex-col items-center">
                   {/* Custom CSS Gauge for Cibil */}
                   <div 
                     className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-700 bg-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.3)] transition-all duration-500"
                     style={{ borderColor: getScoreColor(creditScores.cibil), boxShadow: getScoreGlow(creditScores.cibil) }}
                   >
                      <span className="text-xl font-bold text-white">{creditScores.cibil}</span>
                   </div>
                   <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">CIBIL</span>
                </div>
                
                <div className="flex flex-col items-center">
                   <div 
                     className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-700 bg-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.3)] transition-all duration-500"
                     style={{ borderColor: getScoreColor(creditScores.experian), boxShadow: getScoreGlow(creditScores.experian) }}
                   >
                      <span className="text-xl font-bold text-white">{creditScores.experian}</span>
                   </div>
                   <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Experian</span>
                </div>
             </div>
             
             <p className="mt-4 text-center text-xs text-slate-400 relative z-10">Based on full score of 900</p>
          </div>

          {/* AI Insights */}
          <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">AI Insights</h3>
            <div className="space-y-4">
              <div className="flex gap-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 p-4 border border-rose-100 dark:border-rose-900/30">
                <ShieldAlert className="h-6 w-6 shrink-0 text-rose-500" />
                <div>
                  <h4 className="font-medium text-rose-900 dark:text-rose-100">High Debt Usage</h4>
                  <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">Your EMI burden is 32% of income. Aim to reduce this below 30%.</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-4 border border-emerald-100 dark:border-emerald-900/30">
                <DollarSign className="h-6 w-6 shrink-0 text-emerald-500" />
                <div>
                  <h4 className="font-medium text-emerald-900 dark:text-emerald-100">Emergency Fund</h4>
                  <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">You have 4 months of expenses saved. Great job! Aim for 6.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Credit Score Modal */}
      {isScoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
           <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white">Update Credit Scores</h3>
                 <button onClick={() => setIsScoreModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              
              <form onSubmit={handleSaveScores} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CIBIL Score (300-900)</label>
                    <input 
                      type="number" 
                      min="300" max="900"
                      value={tempScores.cibil} 
                      onChange={e => setTempScores({...tempScores, cibil: parseInt(e.target.value) || 0})}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Experian Score (300-900)</label>
                    <input 
                      type="number" 
                      min="300" max="900"
                      value={tempScores.experian} 
                      onChange={e => setTempScores({...tempScores, experian: parseInt(e.target.value) || 0})}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                 </div>
                 <button 
                   type="submit" 
                   className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                 >
                   Update Scores
                 </button>
              </form>
           </div>
        </div>
      )}

    </div>
  );
};
