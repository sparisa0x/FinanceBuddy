import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string | null;
}

const CATEGORIES = {
  income:  ['Salary', 'Freelance', 'Investment Returns', 'Rental', 'Gift', 'Other'],
  expense: ['Rent', 'Groceries', 'Utilities', 'Transport', 'Healthcare', 'Education', 'Entertainment', 'Shopping', 'EMI', 'Other'],
};

const fmt = (n: number) =>
  '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(n));

export const IncomeExpense: React.FC = () => {
  const { user  } = useAuth();
  const { refetch } = useFinance();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [type,        setType]        = useState<'income' | 'expense'>('expense');
  const [category,    setCategory]    = useState('Groceries');
  const [amount,      setAmount]      = useState('');
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    if (error) { toast.error(error.message); }
    else        { setTransactions(data as Transaction[]); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Reset category when type changes
  useEffect(() => {
    setCategory(type === 'income' ? 'Salary' : 'Groceries');
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      type, category,
      amount: Number(amount),
      date,
      description: description || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Transaction added');
      setAmount(''); setDescription(''); setShowForm(false);
      await load(); refetch();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Delete this transaction?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
    if (error) { toast.error(error.message); }
    else        { toast.success('Deleted'); setTransactions(prev => prev.filter(t => t.id !== id)); refetch(); }
  };

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Income & Expenses</h1>
        <button onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Total Income</p>
          <p className="text-lg font-bold text-green-400">{fmt(totalIncome)}</p>
        </div>
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Total Expense</p>
          <p className="text-lg font-bold text-red-400">{fmt(totalExpense)}</p>
        </div>
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Net Savings</p>
          <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
            {fmt(totalIncome - totalExpense)}
          </p>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type toggle */}
            <div className="flex rounded-lg overflow-hidden border border-slate-700 w-fit">
              {(['expense', 'income'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`px-5 py-2 text-sm font-semibold transition-colors ${type === t ? (t === 'income' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-slate-700 text-slate-400 hover:text-white'}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                  {CATEGORIES[type].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Amount (₹)</label>
                <input required type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="0" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date</label>
                <input required type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. Monthly rent" />
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Plus className="h-4 w-4" />Save</>}
            </button>
          </form>
        </div>
      )}

      {/* Transactions list */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-800" />)}</div>
      ) : transactions.length === 0 ? (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-8 text-center text-slate-500">No transactions yet</div>
      ) : (
        <div className="space-y-2">
          {transactions.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-xl bg-slate-800 border border-slate-700 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-white">{t.category}</p>
                <p className="text-xs text-slate-500">{t.date}{t.description ? ` · ${t.description}` : ''}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-bold text-sm ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                </span>
                <button onClick={() => handleDelete(t.id)} className="text-slate-600 hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
