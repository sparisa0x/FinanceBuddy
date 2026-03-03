import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Shield, Key, CheckCircle, AlertCircle, UserCircle, Save, Loader2 } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();

  const [name,         setName]         = useState(profile?.name ?? '');
  const [income,       setIncome]       = useState(String(profile?.monthly_income ?? ''));
  const [savings,      setSavings]      = useState(String(profile?.monthly_savings_target ?? ''));
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPwd,       setSavingPwd]       = useState(false);

  const [cibil,    setCibil]    = useState('');
  const [experian, setExperian] = useState('');
  const [savingCredit, setSavingCredit] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({
      name:                   name.trim(),
      monthly_income:         Number(income) || 0,
      monthly_savings_target: Number(savings) || 0,
    }).eq('id', user.id);
    if (error) { toast.error(error.message); }
    else        { toast.success('Profile saved'); await refreshProfile(); }
    setSavingProfile(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 8)          { toast.error('Password must be at least 8 characters'); return; }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error(error.message); }
    else        { toast.success('Password updated'); setNewPassword(''); setConfirmPassword(''); }
    setSavingPwd(false);
  };

  const handleSaveCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingCredit(true);
    const { error } = await supabase.from('credit_scores').upsert({
      user_id:  user.id,
      cibil:    cibil    ? Number(cibil)    : null,
      experian: experian ? Number(experian) : null,
    }, { onConflict: 'user_id' });
    if (error) { toast.error(error.message); }
    else        { toast.success('Credit scores saved'); setCibil(''); setExperian(''); }
    setSavingCredit(false);
  };

  const initials = (profile?.name ?? user?.email ?? 'U')
    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Profile & Security</h2>

      {/* Avatar */}
      <div className="flex items-center gap-5 rounded-xl bg-slate-800 border border-slate-700 p-6">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
          {initials || <UserCircle className="w-8 h-8" />}
        </div>
        <div>
          <p className="font-semibold text-white">{profile?.name || 'No name set'}</p>
          <p className="text-sm text-slate-400">{user?.email}</p>
        </div>
      </div>

      {/* Profile info */}
      <form onSubmit={handleSaveProfile} className="rounded-xl bg-slate-800 border border-slate-700 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Profile Details</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              placeholder="Your name" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Monthly Income (₹)</label>
            <input type="number" min="0" value={income} onChange={e => setIncome(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              placeholder="50000" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Monthly Savings Target (₹)</label>
            <input type="number" min="0" value={savings} onChange={e => setSavings(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              placeholder="10000" />
          </div>
        </div>
        <button type="submit" disabled={savingProfile}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {savingProfile ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Profile</>}
        </button>
      </form>

      {/* Credit Scores */}
      <form onSubmit={handleSaveCredit} className="rounded-xl bg-slate-800 border border-slate-700 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-400" /> Credit Scores
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">CIBIL Score (300–900)</label>
            <input type="number" min="300" max="900" value={cibil} onChange={e => setCibil(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              placeholder="750" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Experian Score (300–900)</label>
            <input type="number" min="300" max="900" value={experian} onChange={e => setExperian(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              placeholder="760" />
          </div>
        </div>
        <button type="submit" disabled={savingCredit}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {savingCredit ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <><Save className="h-4 w-4" />Save Scores</>}
        </button>
      </form>

      {/* Change Password */}
      <form onSubmit={handleChangePassword} className="rounded-xl bg-slate-800 border border-slate-700 p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Key className="h-4 w-4 text-indigo-400" /> Change Password
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">New Password</label>
            <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Confirm Password</label>
            <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              placeholder="Repeat password" />
          </div>
        </div>
        {newPassword && confirmPassword && newPassword !== confirmPassword && (
          <p className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5" /> Passwords do not match
          </p>
        )}
        {newPassword && confirmPassword && newPassword === confirmPassword && (
          <p className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle className="h-3.5 w-3.5" /> Passwords match
          </p>
        )}
        <button type="submit" disabled={savingPwd}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {savingPwd ? <><Loader2 className="h-4 w-4 animate-spin" />Updating…</> : <><Key className="h-4 w-4" />Update Password</>}
        </button>
      </form>
    </div>
  );
};
