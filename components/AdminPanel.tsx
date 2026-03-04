import React, { useEffect, useState, useCallback } from 'react';
import { useFinance } from '../context/FinanceContext';
import { CheckCircle, XCircle, User, Mail, ShieldAlert, RefreshCw, Clock, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const AdminPanel: React.FC = () => {
  const { pendingUsers, fetchPendingUsers, approveUser, rejectUser, isAdmin } = useFinance();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchAllUsers = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, username, email, created_at, status, role')
      .order('created_at', { ascending: false });
    if (data) setAllUsers(data);
  }, []);

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchPendingUsers(), fetchAllUsers()]);
    setRefreshing(false);
  }, [fetchPendingUsers, fetchAllUsers]);

  const handleApprove = async (id: string, name: string) => {
    setActionLoading(prev => ({ ...prev, [id + '_approve']: true }));
    setActionError('');
    setActionSuccess('');
    const ok = await approveUser(id);
    setActionLoading(prev => ({ ...prev, [id + '_approve']: false }));
    if (ok) {
      setActionSuccess(`${name} has been approved.`);
      // Also refresh the all-users list
      fetchAllUsers();
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(`Failed to approve ${name}. Make sure the is_admin() SQL function and RLS policies are deployed in Supabase.`);
    }
  };

  const handleReject = async (id: string, name: string) => {
    setActionLoading(prev => ({ ...prev, [id + '_reject']: true }));
    setActionError('');
    setActionSuccess('');
    const ok = await rejectUser(id);
    setActionLoading(prev => ({ ...prev, [id + '_reject']: false }));
    if (ok) {
      setActionSuccess(`${name} has been rejected.`);
      fetchAllUsers();
      setTimeout(() => setActionSuccess(''), 3000);
    } else {
      setActionError(`Failed to reject ${name}. Make sure the is_admin() SQL function and RLS policies are deployed in Supabase.`);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;

    doRefresh();

    // Auto-poll every 10s (Realtime requires paid Supabase plan)
    const interval = setInterval(doRefresh, 10_000);

    return () => {
      clearInterval(interval);
    };
  }, [isAdmin, doRefresh]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <ShieldAlert className="w-12 h-12 mb-4 text-rose-500" />
        <p className="text-lg font-semibold">Access Denied</p>
        <p>You do not have administrative privileges.</p>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Control Panel</h2>
          <p className="text-slate-500">Manage user access and approvals.</p>
        </div>
        <button
          onClick={doRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh List'}
        </button>
      </div>

      {/* Tabs */}
      {actionError && (
        <div className="rounded-lg border border-rose-900/30 bg-rose-900/20 p-3 text-sm text-rose-400">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-lg border border-emerald-900/30 bg-emerald-900/20 p-3 text-sm text-emerald-300">
          {actionSuccess}
        </div>
      )}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'pending' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Clock className="inline h-4 w-4 mr-1" />
          Pending Requests
          <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{pendingUsers.length}</span>
        </button>
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'all' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Users className="inline h-4 w-4 mr-1" />
          All Users
          <span className="ml-2 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 text-xs px-2 py-0.5 rounded-full">{allUsers.length}</span>
        </button>
      </div>

      {/* Pending Tab */}
      {tab === 'pending' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {pendingUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <p>No pending registration requests.</p>
              <p className="text-xs mt-2 text-slate-400">New registrations will appear here automatically.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingUsers.map(user => (
                <div key={user.username || user.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <User className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{user.name}</p>
                      <p className="text-sm text-slate-500">@{user.username}</p>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                        <Mail className="w-3 h-3" /> {user.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => handleReject(user.id, user.name)}
                      disabled={actionLoading[user.id + '_reject'] || actionLoading[user.id + '_approve']}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/30 dark:hover:bg-rose-900/20 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> {actionLoading[user.id + '_reject'] ? 'Rejecting...' : 'Reject'}
                    </button>
                    <button
                      onClick={() => handleApprove(user.id, user.name)}
                      disabled={actionLoading[user.id + '_approve'] || actionLoading[user.id + '_reject']}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" /> {actionLoading[user.id + '_approve'] ? 'Approving...' : 'Approve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Users Tab */}
      {tab === 'all' && (
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-4 py-3 font-medium text-slate-500">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Username</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Email</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map(u => (
                  <tr key={u.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{u.name}</td>
                    <td className="px-4 py-3 text-slate-500">@{u.username}</td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${statusBadge(u.status)}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(u.id, u.name)} disabled={!!actionLoading[u.id + '_approve']} className="text-xs text-emerald-600 hover:underline font-medium disabled:opacity-50">{actionLoading[u.id + '_approve'] ? 'Approving...' : 'Approve'}</button>
                          <button onClick={() => handleReject(u.id, u.name)} disabled={!!actionLoading[u.id + '_reject']} className="text-xs text-rose-600 hover:underline font-medium disabled:opacity-50">{actionLoading[u.id + '_reject'] ? 'Rejecting...' : 'Reject'}</button>
                        </div>
                      )}
                      {u.status === 'rejected' && (
                        <button onClick={() => handleApprove(u.id, u.name)} disabled={!!actionLoading[u.id + '_approve']} className="text-xs text-emerald-600 hover:underline font-medium disabled:opacity-50">{actionLoading[u.id + '_approve'] ? 'Approving...' : 'Approve'}</button>
                      )}
                      {u.role === 'admin' && <span className="text-xs text-indigo-500 font-medium">Admin</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};