import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';

export const CalendarView: React.FC = () => {
  const { transactions, addTransaction, currency } = useFinance();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // YYYY-MM-DD
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal Form State
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income'|'expense'>('expense');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleDateClick = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setIsModalOpen(true);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !amount) return;
    
    addTransaction({
       amount: parseFloat(amount),
       type,
       category: category || 'General',
       description: description || 'Calendar Entry',
       date: selectedDate
    });
    
    setAmount('');
    setDescription('');
    setCategory('');
    setIsModalOpen(false);
  };

  const renderCalendarDays = () => {
    const days = [];
    // Empty slots for previous month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 md:h-32 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-800"></div>);
    }
    
    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayTrans = transactions.filter(t => t.date === dateStr);
      const dayTotal = dayTrans.reduce((acc, t) => t.type === 'income' ? acc + t.amount : acc - t.amount, 0);
      
      const isToday = new Date().toISOString().split('T')[0] === dateStr;

      days.push(
        <div 
           key={d} 
           onClick={() => handleDateClick(d)}
           className={`group relative h-24 md:h-32 p-2 border border-slate-100 dark:border-slate-800 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'bg-white dark:bg-slate-900'}`}
        >
           <span className={`text-sm font-semibold ${isToday ? 'bg-indigo-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-slate-500'}`}>
             {d}
           </span>
           
           <div className="mt-2 space-y-1 overflow-y-auto max-h-[70%]">
              {dayTrans.length > 0 && (
                <div className={`text-xs font-bold ${dayTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                   {dayTotal > 0 ? '+' : ''}{currency}{dayTotal.toLocaleString()}
                </div>
              )}
              {dayTrans.slice(0, 2).map((t, idx) => (
                <div key={idx} className="truncate text-[10px] text-slate-400">
                  {t.category}
                </div>
              ))}
              {dayTrans.length > 2 && <div className="text-[10px] text-slate-400">+{dayTrans.length - 2} more</div>}
           </div>

           <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus className="w-4 h-4 text-indigo-500" />
           </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Financial Calendar</h2>
         <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <button onClick={prevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
            <span className="font-semibold text-slate-900 dark:text-white w-32 text-center">
              {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" /></button>
         </div>
      </div>

      <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
         {/* Week Header */}
         <div className="grid grid-cols-7 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
               <div key={day} className="py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                 {day}
               </div>
            ))}
         </div>
         {/* Calendar Grid */}
         <div className="grid grid-cols-7 bg-slate-200 dark:bg-slate-800 gap-px">
            {renderCalendarDays()}
         </div>
      </div>

      {/* Add Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
           <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center mb-6">
                 <div>
                   <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add Entry</h3>
                   <p className="text-sm text-slate-500">{new Date(selectedDate!).toDateString()}</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                 <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 mb-4">
                    <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'expense' ? 'bg-white shadow text-rose-600 dark:bg-slate-700' : 'text-slate-500'}`}>Expense</button>
                    <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${type === 'income' ? 'bg-white shadow text-emerald-600 dark:bg-slate-700' : 'text-slate-500'}`}>Income</button>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount ({currency})</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" autoFocus required />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
                    <input type="text" value={category} onChange={e => setCategory(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="e.g. Food" required />
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Optional details" />
                 </div>

                 <button type="submit" className={`w-full mt-4 rounded-lg py-3 text-sm font-semibold text-white ${type === 'expense' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                   Save Transaction
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};
