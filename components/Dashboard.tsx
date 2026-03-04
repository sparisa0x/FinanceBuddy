import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, ShieldAlert, DollarSign, Edit2, X, ShoppingBag, Cloud, CloudOff } from 'lucide-react';

/** Progress bar that sets width imperatively (avoids JSX style={} lint warning) */
const DynamicBar: React.FC<{ pct: number; className: string }> = ({ pct, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.style.width = `${Math.max(0, Math.min(100, pct))}%`; }, [pct]);
  return <div ref={ref} className={className} />;
};

/** Score gauge ring that sets borderColor + boxShadow imperatively */
const ScoreGauge: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const ref = useRef<HTMLDivElement>(null);
  const color = score >= 750 ? '#10b981' : score >= 650 ? '#f59e0b' : '#f43f5e';
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.borderColor = color;
    ref.current.style.boxShadow = `0 0 15px ${color}66`;
  }, [score, color]);
  return (
    <div className="flex flex-col items-center">
      <div ref={ref} className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-700 bg-slate-800 transition-all duration-500">
        <span className="text-xl font-bold text-white">{score}</span>
      </div>
      <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { netWorth, totalDebt, healthScore, transactions, currency, userName, creditScores, updateCreditScores, wishlist, isCloudConnected, debts, monthlyEMI } = useFinance();
  
  // Local state for credit score editing
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [tempScores, setTempScores] = useState(creditScores);

  const handleSaveScores = (e: React.FormEvent) => {
    e.preventDefault();
    updateCreditScores(tempScores);
    setIsScoreModalOpen(false);
  };

  const income = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);

  // ─── Real calculations ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const curMonthLabel = now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    // Parse transaction dates once
    const dated = transactions.map(t => ({ ...t, _d: new Date(t.date) }));

    // This month / last month
    const thisMonthIncome = dated.filter(t => t.type === 'income' && t._d.getMonth() === curMonth && t._d.getFullYear() === curYear).reduce((s, t) => s + t.amount, 0);
    const thisMonthExpense = dated.filter(t => t.type === 'expense' && t._d.getMonth() === curMonth && t._d.getFullYear() === curYear).reduce((s, t) => s + t.amount, 0);

    const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
    const prevYear = curMonth === 0 ? curYear - 1 : curYear;
    const lastMonthIncome = dated.filter(t => t.type === 'income' && t._d.getMonth() === prevMonth && t._d.getFullYear() === prevYear).reduce((s, t) => s + t.amount, 0);
    const lastMonthExpense = dated.filter(t => t.type === 'expense' && t._d.getMonth() === prevMonth && t._d.getFullYear() === prevYear).reduce((s, t) => s + t.amount, 0);

    // % change helpers
    const pctChange = (cur: number, prev: number): string => {
      if (prev === 0) return cur > 0 ? '+100%' : '0%';
      const pct = ((cur - prev) / prev) * 100;
      return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
    };

    // Net Worth sub: show % change vs last month income-debt
    const incomeChangeLabel = lastMonthIncome > 0
      ? `${pctChange(thisMonthIncome, lastMonthIncome)} vs last month`
      : 'No prior data';

    // Debt repayment: total paid (totalAmount - remaining) / totalAmount
    const totalDebtOriginal = debts.reduce((s, d) => s + d.totalAmount, 0);
    const totalRemaining = debts.reduce((s, d) => s + d.remainingAmount, 0);
    const repaidPct = totalDebtOriginal > 0
      ? `${((totalDebtOriginal - totalRemaining) / totalDebtOriginal * 100).toFixed(0)}% repaid`
      : 'No debts';

    // Expense trend
    const expenseTrend = lastMonthExpense > 0
      ? `${pctChange(thisMonthExpense, lastMonthExpense)} vs last month`
      : curMonthLabel;

    // Monthly trend data (last 6 months)
    const months: { name: string; worth: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(curYear, curMonth - i, 1);
      const mm = m.getMonth();
      const yy = m.getFullYear();
      const label = m.toLocaleDateString('en-IN', { month: 'short' });
      const mIncome = dated.filter(t => t.type === 'income' && t._d.getMonth() === mm && t._d.getFullYear() === yy).reduce((s, t) => s + t.amount, 0);
      const mExpense = dated.filter(t => t.type === 'expense' && t._d.getMonth() === mm && t._d.getFullYear() === yy).reduce((s, t) => s + t.amount, 0);
      months.push({ name: label, worth: mIncome - mExpense });
    }

    // EMI burden %
    const emiBurdenPct = thisMonthIncome > 0
      ? ((monthlyEMI / thisMonthIncome) * 100).toFixed(0)
      : '0';

    // Emergency coverage (months of expenses covered by savings)
    const avgMonthlyExpense = expense > 0 ? expense / Math.max(1, new Set(dated.filter(t => t.type === 'expense').map(t => `${t._d.getFullYear()}-${t._d.getMonth()}`)).size) : 0;
    const savings = Math.max(0, netWorth);
    const emergencyMonths = avgMonthlyExpense > 0 ? Math.floor(savings / avgMonthlyExpense) : 0;

    return {
      incomeChangeLabel,
      repaidPct,
      curMonthLabel,
      expenseTrend,
      trendData: months,
      emiBurdenPct,
      emergencyMonths,
    };
  }, [transactions, debts, netWorth, monthlyEMI, expense]);

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

  // Map health score status to Tailwind text-color class (avoid inline color styles)
  const healthColorClass: Record<string, string> = {
    Excellent: 'text-emerald-400',
    Good: 'text-sky-400',
    Warning: 'text-amber-400',
    Critical: 'text-rose-400',
  };
  const scoreTextColor = healthColorClass[healthScore.status] ?? 'text-slate-300';

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Welcome & Name Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
             <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Welcome back, {userName}
             </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Here's your financial overview for {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.</p>
        </div>
        <div className="flex flex-col md:items-end gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${isCloudConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                {isCloudConnected ? (
                    <>
                       <Cloud className="w-4 h-4" /> Cloud Connected
                    </>
                ) : (
                    <>
                       <CloudOff className="w-4 h-4" /> Offline Mode
                    </>
                )}
            </div>
            <div className="text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg text-center md:text-right">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
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
              <span className={`text-3xl font-bold ${scoreTextColor}`}>{healthScore.score}</span>
              <Activity className="absolute -top-1 -right-1 h-6 w-6 text-emerald-400" />
            </div>
            <div className="text-left">
              <div className={`text-lg font-bold ${scoreTextColor}`}>{healthScore.status}</div>
              <div className="text-sm text-slate-400">Keep it up!</div>
            </div>
          </div>
        </div>
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Net Worth" value={netWorth} subValue={stats.incomeChangeLabel} type={netWorth >= 0 ? 'good' : 'bad'} />
        <StatCard title="Total Debt" value={totalDebt} subValue={stats.repaidPct} type={totalDebt > 0 ? 'bad' : 'good'} />
        <StatCard title="Total Income" value={income} subValue={stats.curMonthLabel} type="neutral" />
        <StatCard title="Total Expenses" value={expense} subValue={stats.expenseTrend} type={expense > income ? 'bad' : 'neutral'} />
      </div>

      {/* Main Content Grid: Chart & Side Panel */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Main Chart */}
        <div className="lg:col-span-2 space-y-6">
           <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="mb-6 text-lg font-semibold text-slate-900 dark:text-white">Net Worth Trend</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trendData}>
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
                                <DynamicBar pct={progress} className="h-full bg-emerald-500 transition-all duration-500" />
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
                <ScoreGauge score={creditScores.cibil} label="CIBIL" />
                <ScoreGauge score={creditScores.experian} label="Experian" />
             </div>
             
             <p className="mt-4 text-center text-xs text-slate-400 relative z-10">Based on full score of 900</p>
          </div>

          {/* AI Insights */}
          <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">AI Insights</h3>
            <div className="space-y-4">
              <div className={`flex gap-3 rounded-lg p-4 border ${Number(stats.emiBurdenPct) > 30 ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/30' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30'}`}>
                <ShieldAlert className={`h-6 w-6 shrink-0 ${Number(stats.emiBurdenPct) > 30 ? 'text-rose-500' : 'text-emerald-500'}`} />
                <div>
                  <h4 className={`font-medium ${Number(stats.emiBurdenPct) > 30 ? 'text-rose-900 dark:text-rose-100' : 'text-emerald-900 dark:text-emerald-100'}`}>
                    {Number(stats.emiBurdenPct) > 30 ? 'High Debt Usage' : 'Healthy Debt Level'}
                  </h4>
                  <p className={`mt-1 text-sm ${Number(stats.emiBurdenPct) > 30 ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                    Your EMI burden is {stats.emiBurdenPct}% of income.{Number(stats.emiBurdenPct) > 30 ? ' Aim to reduce below 30%.' : ' Well managed!'}
                  </p>
                </div>
              </div>
              <div className={`flex gap-3 rounded-lg p-4 border ${stats.emergencyMonths >= 6 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30' : stats.emergencyMonths >= 3 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30' : 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/30'}`}>
                <DollarSign className={`h-6 w-6 shrink-0 ${stats.emergencyMonths >= 6 ? 'text-emerald-500' : stats.emergencyMonths >= 3 ? 'text-amber-500' : 'text-rose-500'}`} />
                <div>
                  <h4 className={`font-medium ${stats.emergencyMonths >= 6 ? 'text-emerald-900 dark:text-emerald-100' : stats.emergencyMonths >= 3 ? 'text-amber-900 dark:text-amber-100' : 'text-rose-900 dark:text-rose-100'}`}>Emergency Fund</h4>
                  <p className={`mt-1 text-sm ${stats.emergencyMonths >= 6 ? 'text-emerald-700 dark:text-emerald-300' : stats.emergencyMonths >= 3 ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`}>
                    You have {stats.emergencyMonths} month{stats.emergencyMonths !== 1 ? 's' : ''} of expenses covered.{stats.emergencyMonths >= 6 ? ' Excellent!' : ' Aim for 6 months.'}
                  </p>
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
                 <button title="Close" onClick={() => setIsScoreModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              
              <form onSubmit={handleSaveScores} className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CIBIL Score (300-900)</label>
                    <input 
                      type="number"
                      title="CIBIL Score"
                      placeholder="300–900"
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
                      title="Experian Score"
                      placeholder="300–900"
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