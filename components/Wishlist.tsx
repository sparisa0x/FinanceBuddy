import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { ShoppingBag, Eye, Check, Clock, Plus, X, Trash2, ShoppingCart } from 'lucide-react';
import { WishlistCategory, WishlistStatus } from '../types';

export const Wishlist: React.FC = () => {
  const { wishlist, netWorth, currency, addToWishlist, updateWishlistItem, deleteWishlistItem, addTransaction } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<WishlistCategory>('want');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [priority, setPriority] = useState<'low'|'medium'|'high'>('medium');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !estimatedCost) return;

    addToWishlist({
      name,
      category,
      estimatedCost: parseFloat(estimatedCost),
      priority
    });

    setIsModalOpen(false);
    setName('');
    setCategory('want');
    setEstimatedCost('');
    setPriority('medium');
  };

  const handlePurchase = (item: any) => {
    if (window.confirm(`Did you just buy "${item.name}" for ${currency}${item.estimatedCost}? This will be recorded as an expense.`)) {
      // 1. Update Wishlist status
      updateWishlistItem(item.id, { status: 'purchased' });
      
      // 2. Add Transaction
      addTransaction({
        amount: item.estimatedCost,
        type: 'expense',
        category: 'Shopping',
        date: new Date().toISOString().split('T')[0],
        description: `Wishlist Purchased: ${item.name}`
      });
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Remove this item from your wishlist?')) {
      deleteWishlistItem(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
           <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Smart Wishlist</h2>
           <p className="text-sm text-slate-500 mt-1">
             Affordable cash: <span className="font-bold text-emerald-500">{currency}{(netWorth * 0.1).toLocaleString()}</span> (10% of Net Worth)
           </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 flex items-center gap-2 shadow-sm transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {wishlist.map((item) => {
          const isAffordable = item.estimatedCost < (netWorth * 0.1);
          return (
            <div key={item.id} className="group relative rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all">
              
              {/* Delete Button */}
              <button 
                onClick={() => handleDelete(item.id)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="flex justify-between items-start mb-3 pr-8">
                 <span className={`px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wide ${
                   item.category === 'need' ? 'bg-blue-100 text-blue-700' : 
                   item.category === 'want' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
                 }`}>
                   {item.category}
                 </span>
                 <div className="flex items-center text-xs text-slate-400">
                   <Eye className="w-3 h-3 mr-1" /> {item.viewCount}
                 </div>
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.name}</h3>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{currency}{item.estimatedCost.toLocaleString()}</p>
              
              <div className="mt-4">
                 <div className="flex justify-between text-xs mb-1">
                   <span>Affordability</span>
                   <span className={isAffordable ? 'text-emerald-500' : 'text-rose-500'}>{isAffordable ? 'Safe to buy' : 'Wait & Save'}</span>
                 </div>
                 <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                   <div className={`h-full ${isAffordable ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: isAffordable ? '100%' : '40%' }}></div>
                 </div>
              </div>

              <div className="mt-6 flex gap-2">
                 {item.status !== 'purchased' ? (
                   <button 
                     onClick={() => handlePurchase(item)}
                     className="flex-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                   >
                     <Check className="w-4 h-4" /> Mark Purchased
                   </button>
                 ) : (
                   <div className="w-full py-2 text-center text-emerald-600 font-bold bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-center gap-2">
                     <Check className="w-4 h-4" /> Purchased
                   </div>
                 )}
              </div>
            </div>
          );
        })}
        
        {/* Add New Placeholder */}
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 transition-colors hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600"
        >
          <div className="rounded-full bg-slate-200 p-3 dark:bg-slate-800">
            <Plus className="h-6 w-6 text-slate-500" />
          </div>
          <span className="mt-2 text-sm font-medium text-slate-900 dark:text-white">Add Wishlist Item</span>
        </button>
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add to Wishlist</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Item Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="e.g. MacBook Air"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Estimated Cost ({currency})</label>
                <input 
                  type="number" 
                  value={estimatedCost} 
                  onChange={e => setEstimatedCost(e.target.value)} 
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
                    <select 
                      value={category}
                      onChange={e => setCategory(e.target.value as any)}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="need">Need</option>
                      <option value="want">Want</option>
                      <option value="luxury">Luxury</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Priority</label>
                    <select 
                      value={priority}
                      onChange={e => setPriority(e.target.value as any)}
                      className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                 </div>
              </div>

              <button 
                type="submit" 
                className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 mt-4 shadow-md"
              >
                Add to Wishlist
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
