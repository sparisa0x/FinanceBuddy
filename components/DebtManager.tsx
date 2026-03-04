import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { AlertCircle, CheckCircle, CreditCard, Plus, X, Pencil, Trash2, HelpCircle } from 'lucide-react';
import { DebtType } from '../types';

export const DebtManager: React.FC = () => {
  const { debts, payEMI, addDebt, updateDebt, deleteDebt, currency } = useFinance();
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPayConfirmOpen, setIsPayConfirmOpen] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<DebtType>('bank');
  const [totalAmount, setTotalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [monthlyEMI, setMonthlyEMI] = useState('');
  const [dueDate, setDueDate] = useState('');

  const resetForm = () => {
    setName('');
    setType('bank');
    setTotalAmount('');
    setInterestRate('');
    setMonthlyEMI('');
    setDueDate('');
    setEditingDebtId(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (debt: any) => {
    setEditingDebtId(debt.id);
    setName(debt.name);
    setType(debt.type);
    setTotalAmount(debt.totalAmount.toString());
    setInterestRate(debt.interestRate.toString());
    setMonthlyEMI(debt.monthlyEMI.toString());
    setDueDate(debt.dueDate.toString());
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the loan "${name}"? This action cannot be undone.`)) {
      deleteDebt(id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !totalAmount || !monthlyEMI) return;

    const debtData = {
      name,
      type,
      totalAmount: parseFloat(totalAmount),
      interestRate: parseFloat(interestRate) || 0,
      monthlyEMI: parseFloat(monthlyEMI),
      dueDate: parseInt(dueDate) || 1,
      isPaused: false
    };

    if (editingDebtId) {
       // Logic to preserve correct remaining amount if total amount changed logic could be complex, 
       // for now assuming simple update or reset remaining if total changes drastically.
       // Here we just update the basic fields. To be safe, if totalAmount changes, we might need to adjust remaining.
       // Simple approach: calculate existing paid amount and deduct from new total.
       const existing = debts.find(d => d.id === editingDebtId);
       let newRemaining = existing?.remainingAmount || debtData.totalAmount;
       
       if (existing && existing.totalAmount !== debtData.totalAmount) {
         const paid = existing.totalAmount - existing.remainingAmount;
         newRemaining = Math.max(0, debtData.totalAmount - paid);
       }

       updateDebt(editingDebtId, { ...debtData, remainingAmount: newRemaining });
    } else {
      addDebt(debtData);
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handlePayClick = (id: string) => {
    setSelectedDebtId(id);
    setIsPayConfirmOpen(true);
  };

  const confirmPayment = () => {
    if (selectedDebtId) {
      const debt = debts.find(d => d.id === selectedDebtId);
      if (debt) {
        payEMI(selectedDebtId, debt.monthlyEMI);
      }
    }
    setIsPayConfirmOpen(false);
    setSelectedDebtId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Debts & EMI Management</h2>
        <button 
          onClick={handleOpenAdd}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 flex items-center gap-2 shadow-sm transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add New Loan
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {debts.map((debt) => {
          const progress = debt.totalAmount > 0 ? ((debt.totalAmount - debt.remainingAmount) / debt.totalAmount) * 100 : 0;
          return (
            <div key={debt.id} className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 transition-transform hover:-translate-y-1">
              
              {/* Action Buttons */}
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={() => handleOpenEdit(debt)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
                  title="Edit Loan"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(debt.id, debt.name)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-full transition-colors"
                  title="Delete Loan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4 flex items-start justify-between pr-16">
                <div className="rounded-full bg-indigo-50 p-3 dark:bg-indigo-900/20">
                  <CreditCard className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate" title={debt.name}>{debt.name}</h3>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${debt.remainingAmount === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {debt.remainingAmount === 0 ? 'Closed' : 'Active'}
                </span>
              </div>
              <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">{debt.type.replace('_', ' ')}</p>

              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Progress</span>
                  <span className="font-medium text-slate-900 dark:text-white">{Math.round(progress)}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-2.5 rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{currency}{(debt.totalAmount - debt.remainingAmount).toLocaleString()} paid</span>
                  <span>{currency}{debt.totalAmount.toLocaleString()} total</span>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-slate-50 dark:bg-slate-800/50 p-4 border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-sm text-slate-500">Next EMI</span>
                   <span className="font-bold text-slate-900 dark:text-white">{currency}{debt.monthlyEMI.toLocaleString()}</span>
                </div>
                 <div className="flex justify-between items-center mb-4">
                   <span className="text-sm text-slate-500">Due Date</span>
                   <span className="text-sm font-medium text-rose-500">{debt.dueDate}{getOrdinal(debt.dueDate)} of month</span>
                </div>
                
                {debt.remainingAmount > 0 ? (
                  <button 
                    onClick={() => handlePayClick(debt.id)}
                    className="w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> EMI Paid
                  </button>
                ) : (
                   <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium py-2">
                     <CheckCircle className="w-5 h-5" /> Loan Closed
                   </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal for Payment */}
      {isPayConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
           <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex flex-col items-center text-center">
                 <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-4">
                    <HelpCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                 </div>
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white">Confirm EMI Payment</h3>
                 <p className="text-slate-500 mt-2 mb-6">Are you sure you want to mark this EMI as paid? This will deduct the amount from your loan balance.</p>
                 <div className="flex gap-3 w-full">
                    <button 
                      onClick={() => setIsPayConfirmOpen(false)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={confirmPayment}
                      className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Yes, Paid
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Add/Edit Loan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 transform transition-all scale-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editingDebtId ? 'Edit Loan Details' : 'Add New Loan'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Loan Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="e.g. Home Loan"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Type</label>
                  <select 
                    value={type}
                    onChange={e => setType(e.target.value as DebtType)}
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="bank">Bank Loan</option>
                    <option value="education">Education Loan</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="family">Friends & Family</option>
                    <option value="informal">Informal</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Total Amount ({currency})</label>
                  <input 
                    type="number" 
                    value={totalAmount} 
                    onChange={e => setTotalAmount(e.target.value)} 
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="500000"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Interest %</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={interestRate} 
                    onChange={e => setInterestRate(e.target.value)} 
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="10.5"
                  />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">EMI ({currency})</label>
                   <input 
                    type="number" 
                    value={monthlyEMI} 
                    onChange={e => setMonthlyEMI(e.target.value)} 
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="5000"
                    required
                  />
                </div>
                <div>
                   <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Due Date (Day)</label>
                   <input 
                    type="number" 
                    min="1" max="31"
                    value={dueDate} 
                    onChange={e => setDueDate(e.target.value)} 
                    className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="5"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 shadow-md"
                >
                  {editingDebtId ? 'Save Changes' : 'Create Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper for ordinal suffix (st, nd, rd, th)
function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
