import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Calendar, ChevronRight, History, Plus, X, Archive } from 'lucide-react';

export const FinancialArchives: React.FC = () => {
  const { transactions, currency, addTransaction, addInvestment } = useFinance();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recordType, setRecordType] = useState<'expense' | 'income' | 'investment'>('expense');

  // Group transactions by Year
  const years = Array.from<number>(new Set(transactions.map(t => new Date(t.date).getFullYear()))).sort((a, b) => b - a);
  // Add current year if not exists
  if (!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear());

  // Form State for Historical Record
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  const handleAddHistorical = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !amount) return;

    if (recordType === 'investment') {
       addInvestment({
          name: description || 'Historical Investment',
          type: 'custom',
          investedAmount: parseFloat(amount),
          currentValue: parseFloat(amount), // Assuming same for history unless specified
          lastUpdated: date
       });
    } else {
       addTransaction({
          amount: parseFloat(amount),
          type: recordType,
          category: category || 'General',
          date: date,
          description: description || 'Historical Record'
       });
    }

    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
     setDate('');
     setAmount('');
     setDescription('');
     setCategory('');
     setRecordType('expense');
  };

  const YearCard: React.FC<{ year: number }> = ({ year }) => {
    const yearTrans = transactions.filter(t => new Date(t.date).getFullYear() === year);
    const income = yearTrans.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
    const expense = yearTrans.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
    const savings = income - expense;

    return (
      <div 
        onClick={() => setSelectedYear(selectedYear === year ? null : year)}
        className={`cursor-pointer rounded-xl border transition-all duration-200 ${selectedYear === year ? 'bg-slate-50 border-indigo-200 ring-1 ring-indigo-200 dark:bg-slate-800/50 dark:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700'}`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-3">
               <div className="p-2.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                 <Calendar className="w-6 h-6" />
               </div>
               <h3 className="text-xl font-bold text-slate-900 dark:text-white">{year}</h3>
             </div>
             <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${selectedYear === year ? 'rotate-90' : ''}`} />
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
             <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Income</p>
                <p className="font-semibold text-emerald-600">{currency}{income.toLocaleString()}</p>
             </div>
             <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Expense</p>
                <p className="font-semibold text-rose-600">{currency}{expense.toLocaleString()}</p>
             </div>
             <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Savings</p>
                <p className={`font-semibold ${savings >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-500'}`}>{currency}{savings.toLocaleString()}</p>
             </div>
          </div>
        </div>

        {/* Expanded Details */}
        {selectedYear === year && (
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
             <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Monthly Breakdown</h4>
             <div className="space-y-2 max-h-60 overflow-y-auto">
               {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(month => {
                  const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
                  const monthTrans = yearTrans.filter(t => new Date(t.date).getMonth() === month);
                  if (monthTrans.length === 0) return null;
                  
                  const mIncome = monthTrans.filter(t => t.type === 'income').reduce((a,b) => a+b.amount, 0);
                  const mExpense = monthTrans.filter(t => t.type === 'expense').reduce((a,b) => a+b.amount, 0);

                  return (
                    <div key={month} className="flex justify-between text-sm p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                       <span className="font-medium text-slate-700 dark:text-slate-300">{monthName}</span>
                       <div className="flex gap-4">
                          <span className="text-emerald-600">+{mIncome.toLocaleString()}</span>
                          <span className="text-rose-600">-{mExpense.toLocaleString()}</span>
                       </div>
                    </div>
                  )
               })}
             </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Financial Archives</h2>
           <p className="text-slate-500">Access all your past financial records and yearly summaries.</p>
        </div>
        <button 
           onClick={() => setIsModalOpen(true)}
           className="flex items-center gap-2 px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 transition-colors"
        >
           <Archive className="w-4 h-4" /> Add Historical Record
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
         {years.map(year => (
           <YearCard key={year} year={year} />
         ))}
      </div>

      {/* Historical Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
           <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add Past Record</h3>
                 <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
              </div>

              <form onSubmit={handleAddHistorical} className="space-y-4">
                 <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 mb-4">
                    {(['expense', 'income', 'investment'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRecordType(t)}
                        className={`flex-1 py-2 text-sm font-medium rounded-md capitalize transition-all ${recordType === t ? 'bg-white shadow-sm dark:bg-slate-700 text-indigo-600' : 'text-slate-500'}`}
                      >
                        {t}
                      </button>
                    ))}
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
                       <input 
                         type="date" 
                         max={new Date().toISOString().split('T')[0]}
                         value={date} 
                         onChange={e => setDate(e.target.value)} 
                         className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                         required
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount ({currency})</label>
                       <input 
                         type="number" 
                         value={amount} 
                         onChange={e => setAmount(e.target.value)} 
                         className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                         required
                       />
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description / Name</label>
                    <input 
                      type="text" 
                      value={description} 
                      onChange={e => setDescription(e.target.value)} 
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      placeholder={recordType === 'investment' ? 'e.g. Gold Purchase' : 'e.g. Old Rent Payment'}
                    />
                 </div>

                 {recordType !== 'investment' && (
                    <div>
                       <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
                       <input 
                         type="text" 
                         value={category} 
                         onChange={e => setCategory(e.target.value)} 
                         className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                         placeholder="e.g. Housing"
                       />
                    </div>
                 )}

                 <button 
                   type="submit" 
                   className="w-full mt-4 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                 >
                   Save to Archives
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};