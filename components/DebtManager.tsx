import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';
import { calculateEMI } from '../lib/finance';

interface Debt {
  id: string;
  name: string;
  principal: number;
  outstanding_principal: number;
  annual_rate: number;
  tenure_months: number;
  start_date: string;
  lender: string | null;
}

const fmt = (n: number) =>
  '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(n));

const payoffDate = (startDate: string, months: number) => {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

export const DebtManager: React.FC = () => {
  const { user } = useAuth();
  const { refetch } = useFinance();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [name,        setName]        = useState('');
  const [principal,   setPrincipal]   = useState('');
  const [outstanding, setOutstanding] = useState('');
  const [annualRate,  setAnnualRate]  = useState('');
  const [tenure,      setTenure]      = useState('');
  const [startDate,   setStartDate]   = useState(new Date().toISOString().split('T')[0]);
  const [lender,      setLender]      = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from('debts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (error) { toast.error(error.message); }
    else        { setDebts(data as Debt[]); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('debts').insert({
      user_id: user.id,
      name,
      principal:             Number(principal),
      outstanding_principal: Number(outstanding),
      annual_rate:           Number(annualRate),
      tenure_months:         Number(tenure),
      start_date:            startDate,
      lender:                lender || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Debt added');
      setName(''); setPrincipal(''); setOutstanding(''); setAnnualRate('');
      setTenure(''); setLender(''); setShowForm(false);
      await load(); refetch();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Delete this debt?')) return;
    const { error } = await supabase.from('debts').delete().eq('id', id).eq('user_id', user.id);
    if (error) { toast.error(error.message); }
    else        { toast.success('Deleted'); setDebts(prev => prev.filter(d => d.id !== id)); refetch(); }
  };

  const totalEMI         = debts.reduce((s, d) => s + calculateEMI(d.outstanding_principal, d.annual_rate, d.tenure_months), 0);
  const totalOutstanding = debts.reduce((s, d) => s + d.outstanding_principal, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Debts & EMI</h1>
        <button onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          <Plus className="h-4 w-4" /> Add Debt
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Total Outstanding</p>
          <p className="text-xl font-bold text-red-400">{fmt(totalOutstanding)}</p>
        </div>
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Total Monthly EMI</p>
          <p className="text-xl font-bold text-yellow-400">{fmt(totalEMI)}</p>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">New Debt</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Debt Name</label>
                <input required value={name} onChange={e => setName(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. Home Loan" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Principal (₹)</label>
                <input required type="number" min="1" value={principal} onChange={e => setPrincipal(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="500000" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Outstanding (₹)</label>
                <input required type="number" min="0" value={outstanding} onChange={e => setOutstanding(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="450000" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Annual Rate (%)</label>
                <input required type="number" min="0" step="0.1" value={annualRate} onChange={e => setAnnualRate(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="8.5" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tenure (months)</label>
                <input required type="number" min="1" value={tenure} onChange={e => setTenure(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="240" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Start Date</label>
                <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Lender (optional)</label>
                <input value={lender} onChange={e => setLender(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="HDFC Bank" />
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Plus className="h-4 w-4" />Save Debt</>}
            </button>
          </form>
        </div>
      )}

      {/* Debt cards */}
      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-800" />)}</div>
      ) : debts.length === 0 ? (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-8 text-center text-slate-500">No debts added yet</div>
      ) : (
        <div className="space-y-4">
          {debts.map(debt => {
            const emi     = calculateEMI(debt.outstanding_principal, debt.annual_rate, debt.tenure_months);
            const paidPct = debt.principal > 0
              ? Math.round(((debt.principal - debt.outstanding_principal) / debt.principal) * 100)
              : 0;
            return (
              <div key={debt.id} className="rounded-xl bg-slate-800 border border-slate-700 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{debt.name}</h3>
                    {debt.lender && <p className="text-xs text-slate-500">{debt.lender}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-red-400">
                      {fmt(emi)}<span className="text-xs font-normal text-slate-500">/mo</span>
                    </span>
                    <button onClick={() => handleDelete(debt.id)} className="text-slate-600 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                  <div><p className="text-xs text-slate-500">Outstanding</p><p className="font-semibold text-white">{fmt(debt.outstanding_principal)}</p></div>
                  <div><p className="text-xs text-slate-500">Rate</p><p className="font-semibold text-white">{debt.annual_rate}%</p></div>
                  <div><p className="text-xs text-slate-500">Payoff</p><p className="font-semibold text-white">{payoffDate(debt.start_date, debt.tenure_months)}</p></div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Progress</span><span>{paidPct}% paid</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700">
                    <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: paidPct + '%' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
