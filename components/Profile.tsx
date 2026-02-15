import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Shield, Key, CheckCircle, AlertCircle, UserCircle, AtSign, Mail, BadgeCheck, Edit3, Save, X } from 'lucide-react';

export const Profile: React.FC = () => {
  const { userName, setUserName, authUsername, userEmail, isAdmin, changePassword, isCloudConnected } = useFinance();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);
  
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
       setStatus('error');
       setMessage("Password must be at least 6 characters");
       return;
    }

    setStatus('idle');
    const success = await changePassword(newPassword);
    
    if (success) {
      setStatus('success');
      setMessage("Password updated successfully");
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setStatus('error');
      setMessage("Failed to update password. Try again.");
    }
  };

  const handleSaveName = () => {
    if (tempName.trim()) {
      setUserName(tempName.trim());
      setEditingName(false);
    }
  };

  const initials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Profile & Security</h2>

      {/* Profile Card */}
      <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
         <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
               {initials || <UserCircle className="w-10 h-10" />}
            </div>
            <div className="flex-1">
               {editingName ? (
                  <div className="flex items-center gap-2">
                     <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="text-xl font-bold rounded-lg border border-indigo-400 bg-white dark:bg-slate-800 px-3 py-1 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                     />
                     <button onClick={handleSaveName} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"><Save className="w-4 h-4" /></button>
                     <button onClick={() => { setEditingName(false); setTempName(userName); }} className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"><X className="w-4 h-4" /></button>
                  </div>
               ) : (
                  <div className="flex items-center gap-2">
                     <h3 className="text-xl font-bold text-slate-900 dark:text-white">{userName}</h3>
                     <button onClick={() => { setEditingName(true); setTempName(userName); }} className="p-1 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors"><Edit3 className="w-4 h-4" /></button>
                  </div>
               )}
               <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${isAdmin ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                     <BadgeCheck className="w-3 h-3" />
                     {isAdmin ? 'Super Admin' : 'Member'}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isCloudConnected ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                     <span className={`w-1.5 h-1.5 rounded-full ${isCloudConnected ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                     {isCloudConnected ? 'Online' : 'Offline'}
                  </span>
               </div>
            </div>
         </div>

         {/* Info Grid */}
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
               <AtSign className="w-5 h-5 text-indigo-500" />
               <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Username</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{authUsername || '—'}</p>
               </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
               <Mail className="w-5 h-5 text-indigo-500" />
               <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{userEmail || '—'}</p>
               </div>
            </div>
         </div>
      </div>

      {/* Security Form */}
      <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
         <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Shield className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Change Password</h3>
         </div>

         <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
               <div className="relative mt-1">
                  <Key className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <input 
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="block w-full rounded-lg border border-slate-300 bg-white pl-10 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                    required
                  />
               </div>
            </div>
            <div>
               <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</label>
               <div className="relative mt-1">
                  <Key className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <input 
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="block w-full rounded-lg border border-slate-300 bg-white pl-10 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                    required
                  />
               </div>
            </div>

            {status !== 'idle' && (
               <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${status === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
                  {status === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {message}
               </div>
            )}

            <button 
               type="submit" 
               className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors"
            >
               Update Password
            </button>
         </form>
      </div>
    </div>
  );
};