import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

export const Investments: React.FC = () => {
  const { investments, currency } = useFinance();

  const data = investments.map(i => ({ name: i.type, value: i.currentValue }));
  const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#64748b'];

  const totalInvested = investments.reduce((acc, i) => acc + i.investedAmount, 0);
  const totalCurrent = investments.reduce((acc, i) => acc + i.currentValue, 0);
  const totalGain = totalCurrent - totalInvested;
  const isPositive = totalGain >= 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Portfolio Summary */}
      <div className="lg:col-span-2 space-y-6">
        <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
           <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Portfolio Overview</h2>
              <span className={`flex items-center text-sm font-bold px-3 py-1 rounded-full ${isPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                 {isPositive ? <TrendingUp className="w-4 h-4 mr-1"/> : <TrendingDown className="w-4 h-4 mr-1"/>}
                 {((totalGain / totalInvested) * 100).toFixed(2)}% All Time
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
                   <th className="pb-3 text-sm font-medium text-slate-500">P/L</th>
                 </tr>
               </thead>
               <tbody className="text-sm">
                 {investments.map(inv => {
                   const gain = inv.currentValue - inv.investedAmount;
                   return (
                     <tr key={inv.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                       <td className="py-4 font-medium text-slate-900 dark:text-white">{inv.name}</td>
                       <td className="py-4 text-slate-500 capitalize">{inv.type.replace('_', ' ')}</td>
                       <td className="py-4 text-slate-500">{currency}{inv.investedAmount.toLocaleString()}</td>
                       <td className="py-4 font-semibold text-slate-900 dark:text-white">{currency}{inv.currentValue.toLocaleString()}</td>
                       <td className={`py-4 font-medium ${gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                         {gain >= 0 ? '+' : ''}{currency}{gain.toLocaleString()}
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
               <span className="font-medium text-slate-900 dark:text-white">{((entry.value / totalCurrent) * 100).toFixed(1)}%</span>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};
