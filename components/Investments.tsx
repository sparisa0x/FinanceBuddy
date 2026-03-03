import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';

interface Investment {
  id: string;
  name: string;
  type: string;
  invested_amount: number;
  current_value: number;
  date: string;
  notes: string | null;
}

const INV_TYPES: Record<string, string> = {
  stocks: 'Stocks', mutual_fund: 'Mutual Fund', fd: 'FD',
  gold: 'Gold', real_estate: 'Real Estate', crypto: 'Crypto', other: 'Other',
};

const fmt = (n: number) =>
  '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(n));

const gainLoss = (inv: number, cur: number) => {
  const gl    = cur - inv;
  const glPct = inv > 0 ? Math.round((gl / inv) * 100 * 10) / 10 : 0;
  return { gl, glPct };
};

export const Investments: React.FC = () => {
  const { user } = useAuth();
  const { refetch } = useFinance();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [name,    setName]    = useState('');
  const [type,    setType]    = useState('stocks');
  const [invested, setInvested] = useState('');
  const [current,  setCurrent]  = useState('');
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0]);
  const [notes,    setNotes]    = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from('investments').select('*').eq('user_id', user.id).order('date', { ascending: false });
    if (error) { toast.error(error.message); }
    else        { setInvestments(data as Investment[]); }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('investments').insert({
      user_id: user.id,
      name, type,
      invested_amount: Number(invested),
      current_value:   Number(current),
      date,
      notes: notes || null,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Investment added');
      setName(''); setInvested(''); setCurrent(''); setNotes(''); setShowForm(false);
      await load(); refetch();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Delete this investment?')) return;
    const { error } = await supabase.from('investments').delete().eq('id', id).eq('user_id', user.id);
    if (error) { toast.error(error.message); }
    else        { toast.success('Deleted'); setInvestments(prev => prev.filter(i => i.id !== id)); refetch(); }
  };

  const totalInvested = investments.reduce((s, i) => s + i.invested_amount, 0);
  const totalCurrent  = investments.reduce((s, i) => s + i.current_value, 0);
  const totalGain     = totalCurrent - totalInvested;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Investments</h1>
        <button onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Total Invested</p>
          <p className="text-lg font-bold text-white">{fmt(totalInvested)}</p>
        </div>
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Current Value</p>
          <p className="text-lg font-bold text-white">{fmt(totalCurrent)}</p>
        </div>
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-4">
          <p className="text-xs text-slate-400 uppercase mb-1">Total Gain / Loss</p>
          <p className={`text-lg font-bold ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalGain >= 0 ? '+' : '-'}{fmt(Math.abs(totalGain))}
          </p>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input required value={name} onChange={e => setName(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. Nifty 50 Index Fund" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Type</label>
                <select value={type} onChange={e => setType(e.target.value)}
                  title="Investment type"
                  aria-label="Investment type"
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                  {Object.entries(INV_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                  title="Investment date"
                  aria-label="Investment date"
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Amount Invested (₹)</label>
                <input required type="number" min="1" value={invested} onChange={e => setInvested(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="10000" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Current Value (₹)</label>
                <input required type="number" min="0" value={current} onChange={e => setCurrent(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="12500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)}
                  title="Investment notes"
                  aria-label="Investment notes"
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Plus className="h-4 w-4" />Add Investment</>}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-800" />)}</div>
      ) : investments.length === 0 ? (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-8 text-center text-slate-500">No investments yet</div>
      ) : (
        <div className="space-y-3">
          {investments.map(inv => {
            const { gl, glPct } = gainLoss(inv.invested_amount, inv.current_value);
            return (
              <div key={inv.id} className="rounded-xl bg-slate-800 border border-slate-700 p-5 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{inv.name}</span>
                    <span className="text-xs bg-slate-700 text-slate-400 rounded-full px-2 py-0.5">{INV_TYPES[inv.type] ?? inv.type}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>Invested: {fmt(inv.invested_amount)}</span>
                    <span>Current: {fmt(inv.current_value)}</span>
                    <span>{inv.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="text-right">
                    <div className={`flex items-center gap-1 font-semibold text-sm ${gl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {gl >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {gl >= 0 ? '+' : ''}{glPct}%
                    </div>
                    <div className={`text-xs ${gl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {gl >= 0 ? '+' : '-'}{fmt(Math.abs(gl))}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(inv.id)} className="text-slate-600 hover:text-red-400" title="Delete investment" aria-label="Delete investment">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
