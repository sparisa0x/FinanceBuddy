import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, Target, PlusCircle, Trash2 } from 'lucide-react';
import { InvestmentType } from '../types';

export const Investments: React.FC = () => {
  const { investments, currency, addInvestment, deleteInvestment } = useFinance();

  const [name, setName] = useState('');
  const [type, setType] = useState<InvestmentType>('stock');
  const [investedAmount, setInvestedAmount] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [goalName, setGoalName] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [expectedAnnualReturn, setExpectedAnnualReturn] = useState('');
  const [tenureMonths, setTenureMonths] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');

  const data = investments.map(i => ({ name: i.type, value: i.currentValue }));
  const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#64748b'];

  const totalInvested = investments.reduce((acc, i) => acc + i.investedAmount, 0);
  const totalCurrent = investments.reduce((acc, i) => acc + i.currentValue, 0);
  const totalGain = totalCurrent - totalInvested;
  const isPositive = totalGain >= 0;
  const allTimePercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const totalTarget = investments.reduce((acc, i) => acc + (i.targetValue || 0), 0);
  const overallTargetProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  const weightedReturn = useMemo(() => {
    if (!totalInvested) return 0;
    return (totalGain / totalInvested) * 100;
  }, [totalInvested, totalGain]);

  const handleAddInvestment = (e: React.FormEvent) => {
    e.preventDefault();

    const invested = Number(investedAmount);
    const current = Number(currentValue);
    if (!name.trim() || invested <= 0 || current <= 0) return;

    addInvestment({
      name: name.trim(),
      type,
      investedAmount: invested,
      currentValue: current,
      lastUpdated: new Date().toISOString().split('T')[0],
      goalName: goalName.trim() || undefined,
      targetValue: targetValue ? Number(targetValue) : 0,
      expectedAnnualReturn: expectedAnnualReturn ? Number(expectedAnnualReturn) : 0,
      tenureMonths: tenureMonths ? Number(tenureMonths) : 0,
      monthlyContribution: monthlyContribution ? Number(monthlyContribution) : 0,
      interestRate: interestRate ? Number(interestRate) : 0,
      riskLevel,
      notes: notes.trim() || undefined,
    });

    setName('');
    setType('stock');
    setInvestedAmount('');
    setCurrentValue('');
    setGoalName('');
    setTargetValue('');
    setInterestRate('');
    setExpectedAnnualReturn('');
    setTenureMonths('');
    setMonthlyContribution('');
    setRiskLevel('medium');
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">Total Invested</p>
          <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{currency}{totalInvested.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">Current Value</p>
          <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{currency}{totalCurrent.toLocaleString()}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">All-Time Return</p>
          <p className={`mt-2 text-xl font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>{weightedReturn.toFixed(2)}%</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">Goal Progress</p>
          <p className="mt-2 text-xl font-bold text-indigo-500">{overallTargetProgress.toFixed(1)}%</p>
        </div>
      </div>

      <form onSubmit={handleAddInvestment} className="rounded-xl bg-white dark:bg-slate-900 p-5 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="mb-4 flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-indigo-500" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Investment & Planning Details</h3>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Asset name" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" required />
          <select value={type} onChange={e => setType(e.target.value as InvestmentType)} className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" title="Investment type">
            <option value="stock">Stock</option>
            <option value="mutual_fund">Mutual Fund</option>
            <option value="fd">FD</option>
            <option value="gold">Gold</option>
            <option value="real_estate">Real Estate</option>
            <option value="crypto">Crypto</option>
            <option value="custom">Custom</option>
          </select>
          <input type="number" value={investedAmount} onChange={e => setInvestedAmount(e.target.value)} placeholder="Invested amount" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" required />
          <input type="number" value={currentValue} onChange={e => setCurrentValue(e.target.value)} placeholder="Current value" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" required />
          <input value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="Goal name (optional)" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
          <input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} placeholder="Target value" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
          <input type="number" value={interestRate} onChange={e => setInterestRate(e.target.value)} placeholder="Interest rate %" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
          <input type="number" value={expectedAnnualReturn} onChange={e => setExpectedAnnualReturn(e.target.value)} placeholder="Expected annual return %" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
          <input type="number" value={tenureMonths} onChange={e => setTenureMonths(e.target.value)} placeholder="Term (months)" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
          <input type="number" value={monthlyContribution} onChange={e => setMonthlyContribution(e.target.value)} placeholder="Monthly contribution" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
          <select value={riskLevel} onChange={e => setRiskLevel(e.target.value as 'low' | 'medium' | 'high')} className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" title="Risk level">
            <option value="low">Low risk</option>
            <option value="medium">Medium risk</option>
            <option value="high">High risk</option>
          </select>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Terms / notes" className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
        </div>

        <button type="submit" className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Add Investment
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-3">
      {/* Portfolio Summary */}
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
           <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Portfolio Overview</h2>
              <span className={`flex items-center text-sm font-bold px-3 py-1 rounded-full ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                 {isPositive ? <TrendingUp className="w-4 h-4 mr-1"/> : <TrendingDown className="w-4 h-4 mr-1"/>}
                  {allTimePercent.toFixed(2)}% All Time
              </span>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead>
                 <tr className="border-b border-slate-100 dark:border-slate-800">
                   <th className="pb-3 text-sm font-medium text-slate-500">Asset Name</th>
                   <th className="pb-3 text-sm font-medium text-slate-500">Type</th>
                   <th className="pb-3 text-sm font-medium text-slate-500">Invested</th>
                   <th className="pb-3 text-sm font-medium text-slate-500">Current Value</th>
                   <th className="pb-3 text-sm font-medium text-slate-500">Goal</th>
                   <th className="pb-3 text-sm font-medium text-slate-500">Term / Interest</th>
                   <th className="pb-3 text-sm font-medium text-slate-500">P/L</th>
                   <th className="pb-3 text-sm font-medium text-slate-500 w-12"></th>
                 </tr>
               </thead>
               <tbody className="text-sm">
                 {investments.map(inv => {
                   const gain = inv.currentValue - inv.investedAmount;
                   const goal = inv.targetValue || 0;
                   const goalPercent = goal > 0 ? (inv.currentValue / goal) * 100 : 0;
                   return (
                     <tr key={inv.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                       <td className="py-4 font-medium text-slate-900 dark:text-white">{inv.name}</td>
                       <td className="py-4 text-slate-500 capitalize">{inv.type.replace('_', ' ')}</td>
                       <td className="py-4 text-slate-500">{currency}{inv.investedAmount.toLocaleString()}</td>
                       <td className="py-4 font-semibold text-slate-900 dark:text-white">{currency}{inv.currentValue.toLocaleString()}</td>
                       <td className="py-4 text-slate-500">
                         {inv.goalName ? (
                           <div>
                             <p className="font-medium text-slate-700 dark:text-slate-200">{inv.goalName}</p>
                             <p className="text-xs">{goal > 0 ? `${goalPercent.toFixed(1)}% of ${currency}${goal.toLocaleString()}` : 'No target'}</p>
                           </div>
                         ) : '—'}
                       </td>
                       <td className="py-4 text-slate-500">
                         <div className="text-xs">
                           <p>{inv.tenureMonths ? `${inv.tenureMonths} months` : 'Flexible term'}</p>
                           <p>{inv.interestRate ? `${inv.interestRate}% interest` : inv.expectedAnnualReturn ? `${inv.expectedAnnualReturn}% expected` : '—'}</p>
                         </div>
                       </td>
                       <td className={`py-4 font-medium ${gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                         {gain >= 0 ? '+' : ''}{currency}{gain.toLocaleString()}
                       </td>
                       <td className="py-4">
                         <button
                           onClick={() => {
                             if (window.confirm(`Delete investment "${inv.name}"? This cannot be undone.`)) {
                               deleteInvestment(inv.id);
                             }
                           }}
                           className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-full transition-colors"
                           title="Delete investment"
                         >
                           <Trash2 className="h-4 w-4" />
                         </button>
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           </div>
        </div>
      </div>

      {/* Allocation Chart */}
      <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Allocation</h3>
        <div className="h-64 w-full">
           <ResponsiveContainer width="100%" height="100%">
             <PieChart>
               <Pie
                 data={data}
                 cx="50%"
                 cy="50%"
                 innerRadius={60}
                 outerRadius={80}
                 paddingAngle={5}
                 dataKey="value"
               >
                 {data.map((entry, index) => (
                   <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                 ))}
               </Pie>
               <Tooltip />
             </PieChart>
           </ResponsiveContainer>
        </div>
        <div className="space-y-3 mt-4">
           {data.map((entry, index) => (
             <div key={index} className="flex items-center justify-between text-sm">
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                 <span className="text-slate-600 dark:text-slate-300 capitalize">{entry.name.replace('_', ' ')}</span>
               </div>
               <span className="font-medium text-slate-900 dark:text-white">{totalCurrent > 0 ? ((entry.value / totalCurrent) * 100).toFixed(1) : '0.0'}%</span>
             </div>
           ))}
        </div>
        <div className="mt-6 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
          <p className="text-xs text-slate-500 mb-1">Planning Snapshot</p>
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <Target className="h-4 w-4 text-indigo-500" />
            Goal Tracking Active for {investments.filter(i => (i.targetValue || 0) > 0).length} assets
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};
