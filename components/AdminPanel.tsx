import React, { useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { CheckCircle, XCircle, User, Mail, ShieldAlert } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const { pendingUsers, fetchPendingUsers, approveUser, rejectUser, isAdmin } = useFinance();

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <ShieldAlert className="w-12 h-12 mb-4 text-rose-500" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p>You do not have administrative privileges.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Control Panel</h2>
            <p className="text-slate-500">Manage user access and approvals.</p>
          </div>
          <button 
             onClick={fetchPendingUsers}
             className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
             Refresh List
          </button>
       </div>

       <div className="rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
             <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Pending Requests
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{pendingUsers.length}</span>
             </h3>
          </div>
          
          {pendingUsers.length === 0 ? (
             <div className="p-8 text-center text-slate-500">
                <p>No pending registration requests.</p>
             </div>
          ) : (
             <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingUsers.map(user => (
                   <div key={user.username} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                         <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <User className="h-5 w-5 text-slate-500" />
                         </div>
                         <div>
                            <p className="font-bold text-slate-900 dark:text-white">{user.displayName}</p>
                            <p className="text-sm text-slate-500">@{user.username}</p>
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                               <Mail className="w-3 h-3" /> {user.email}
                            </div>
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                         <button 
                           onClick={() => rejectUser(user.username)}
                           className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-900/20 text-sm font-medium transition-colors"
                         >
                            <XCircle className="w-4 h-4" /> Reject
                         </button>
                         <button 
                           onClick={() => approveUser(user.username)}
                           className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium transition-colors shadow-sm"
                         >
                            <CheckCircle className="w-4 h-4" /> Approve
                         </button>
                      </div>
                   </div>
                ))}
             </div>
          )}
       </div>
    </div>
  );
};