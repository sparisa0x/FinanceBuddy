import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Plus, ArrowDown, ArrowUp } from 'lucide-react';

export const IncomeExpense: React.FC = () => {
  const { transactions, addTransaction, currency } = useFinance();
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) return;
    addTransaction({
      amount: parseFloat(amount),
      category,
      description,
      type: activeTab,
      date: new Date().toISOString().split('T')[0]
    });
    setAmount('');
    setDescription('');
    setCategory('');
  };

  const filteredTransactions = transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Input Form */}
      <div className="h-fit rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">Add New {activeTab === 'income' ? 'Income' : 'Expense'}</h2>
        
        <div className="mb-6 flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
          <button 
            onClick={() => setActiveTab('income')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${activeTab === 'income' ? 'bg-white text-emerald-600 shadow-sm dark:bg-slate-700 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'}`}
          >
            Income
          </button>
          <button 
            onClick={() => setActiveTab('expense')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${activeTab === 'expense' ? 'bg-white text-rose-600 shadow-sm dark:bg-slate-700 dark:text-rose-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'}`}
          >
            Expense
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-2.5 text-slate-500">{currency}</span>
              <input 
                type="number" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 bg-white pl-8 py-2 text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="0.00"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
            <select 
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              required
            >
              <option value="">Select Category</option>
              {activeTab === 'income' ? (
                <>
                  <option value="Salary">Salary</option>
                  <option value="Freelance">Freelance</option>
                  <option value="Business">Business</option>
                  <option value="Passive">Passive</option>
                </>
              ) : (
                <>
                  <option value="Food">Food & Dining</option>
                  <option value="Rent">Rent & Housing</option>
                  <option value="Transport">Transport</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Entertainment">Entertainment</option>
                </>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <input 
              type="text" 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="E.g., October Salary"
            />
          </div>
          <button 
            type="submit" 
            className={`w-full rounded-lg py-2.5 font-semibold text-white shadow-md transition-colors ${activeTab === 'income' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}
          >
            <Plus className="inline h-5 w-5 mr-2" />
            Add {activeTab}
          </button>
        </form>
      </div>

      {/* Recent List */}
      <div className="flex flex-col rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 h-[600px]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Transactions</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredTransactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800">
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                  {t.type === 'income' ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{t.category}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {t.type === 'income' ? '+' : '-'}{currency}{t.amount.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400">{t.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
