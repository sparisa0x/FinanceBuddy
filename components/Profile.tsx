import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Shield, Key, CheckCircle, AlertCircle, UserCircle } from 'lucide-react';

export const Profile: React.FC = () => {
  const { userName, changePassword } = useFinance();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Profile & Security</h2>

      {/* Profile Card */}
      <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-6">
         <div className="h-20 w-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <UserCircle className="w-10 h-10" />
         </div>
         <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{userName}</h3>
            <p className="text-slate-500 dark:text-slate-400">Premium Member</p>
         </div>
      </div>

      {/* Security Form */}
      <div className="rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
         <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <Shield className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Security Settings</h3>
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
                    className="block w-full rounded-lg border border-slate-300 bg-white pl-10 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                    className="block w-full rounded-lg border border-slate-300 bg-white pl-10 py-2 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    required
                  />
               </div>
            </div>

            {status !== 'idle' && (
               <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${status === 'success' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20'}`}>
                  {status === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {message}
               </div>
            )}

            <button 
               type="submit" 
               className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm"
            >
               Update Password
            </button>
         </form>
      </div>
    </div>
  );
};