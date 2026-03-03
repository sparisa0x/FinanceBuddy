import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useFinance } from '../context/FinanceContext';

interface WishlistItem {
  id: string;
  name: string;
  estimated_cost: number;
  priority: 'low' | 'medium' | 'high';
  target_date: string | null;
  is_purchased: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low:    'bg-green-500/20 text-green-400 border-green-500/30',
};
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const fmt = (n: number) =>
  '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(n));

const daysUntil = (dateStr: string | null) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
};

export const Wishlist: React.FC = () => {
  const { user } = useAuth();
  const { refetch } = useFinance();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [name,       setName]       = useState('');
  const [cost,       setCost]       = useState('');
  const [priority,   setPriority]   = useState<'low' | 'medium' | 'high'>('medium');
  const [targetDate, setTargetDate] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('wishlist')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) { toast.error(error.message); }
    else {
      const sorted = (data as WishlistItem[]).sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      );
      setItems(sorted);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from('wishlist').insert({
      user_id: user.id,
      name,
      estimated_cost: Number(cost),
      priority,
      target_date: targetDate || null,
      is_purchased: false,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Added to wishlist');
      setName(''); setCost(''); setTargetDate(''); setShowForm(false);
      await load(); refetch();
    }
    setSaving(false);
  };

  const togglePurchased = async (id: string, current: boolean) => {
    if (!user) return;
    const { error } = await supabase.from('wishlist').update({ is_purchased: !current }).eq('id', id).eq('user_id', user.id);
    if (error) { toast.error(error.message); }
    else {
      toast.success(current ? 'Marked as unpurchased' : 'Marked as purchased!');
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_purchased: !current } : i));
      refetch();
    }
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm('Remove from wishlist?')) return;
    const { error } = await supabase.from('wishlist').delete().eq('id', id).eq('user_id', user.id);
    if (error) { toast.error(error.message); }
    else        { toast.success('Removed'); setItems(prev => prev.filter(i => i.id !== id)); refetch(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Wishlist</h1>
        <button onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Item Name</label>
                <input required value={name} onChange={e => setName(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. New Laptop" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Estimated Cost (₹)</label>
                <input required type="number" min="1" value={cost} onChange={e => setCost(e.target.value)}
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                  placeholder="50000" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                  title="Wishlist priority"
                  aria-label="Wishlist priority"
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Target Date (optional)</label>
                <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
                  title="Wishlist target date"
                  aria-label="Wishlist target date"
                  className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Plus className="h-4 w-4" />Add to Wishlist</>}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-800" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-8 text-center text-slate-500">
          Your wishlist is empty. Add something to save for!
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const days = daysUntil(item.target_date);
            return (
              <div key={item.id} className={`rounded-xl bg-slate-800 border border-slate-700 p-5 ${item.is_purchased ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`font-semibold text-sm ${item.is_purchased ? 'line-through text-slate-500' : 'text-white'}`}>
                        {item.name}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[item.priority]}`}>
                        {item.priority}
                      </span>
                      {item.is_purchased && (
                        <span className="rounded-full bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 text-xs">Purchased</span>
                      )}
                    </div>
                    <p className="text-lg font-bold text-indigo-400">{fmt(item.estimated_cost)}</p>
                    {item.target_date && (
                      <p className={`text-xs mt-1 ${days !== null && days < 30 ? 'text-yellow-400' : 'text-slate-500'}`}>
                        {days === null ? item.target_date : days < 0 ? 'Target date passed' : `${days} days remaining`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={() => togglePurchased(item.id, item.is_purchased)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${item.is_purchased ? 'bg-slate-700 text-slate-400 hover:bg-slate-600' : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'}`}>
                      <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
                      {item.is_purchased ? 'Undo' : 'Mark Bought'}
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="text-slate-600 hover:text-red-400" title="Delete wishlist item" aria-label="Delete wishlist item">
                      <Trash2 className="h-4 w-4" />
                    </button>
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
