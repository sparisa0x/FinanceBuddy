import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Lock, User, ArrowRight, ShieldCheck, Mail, CheckCircle, Eye, EyeOff } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, register } = useFinance();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('Sriram Parisa'); 
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (isRegistering) {
      const result = await register(username, password, displayName, email);
      if (!result.success) {
        setError(result.message || 'Registration failed');
      } else if (result.message && result.message.includes('wait')) {
        // Halt logic trigger
        setSuccessMsg(result.message);
        setIsRegistering(false); // Switch back to login view to show success
      }
    } else {
      const result = await login(username, password);
      if (!result.success) {
        setError(result.message || 'Invalid username or password');
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md animate-fade-in space-y-8 rounded-2xl bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
        
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
            <ShieldCheck className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900 dark:text-white">
            Finance Buddy
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Secure Personal Finance Intelligence
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {successMsg && (
             <div className="rounded-md bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/30 flex gap-2">
               <CheckCircle className="h-5 w-5 shrink-0" />
               <p>{successMsg}</p>
             </div>
          )}

          <div className="space-y-4 rounded-md shadow-sm">
            {isRegistering && (
              <>
               <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white dark:bg-slate-800 py-3 pl-10 text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 sm:text-sm"
                    placeholder="Your Name"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white dark:bg-slate-800 py-3 pl-10 text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 sm:text-sm"
                    placeholder="Enter valid email for approval"
                  />
                </div>
              </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Username
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white dark:bg-slate-800 py-3 pl-10 text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 sm:text-sm"
                  placeholder="Enter username"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white dark:bg-slate-800 py-3 pl-10 pr-10 text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 sm:text-sm"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className={`group relative flex w-full justify-center rounded-lg border border-transparent bg-indigo-600 py-3 px-4 text-sm font-bold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all ${loading ? 'opacity-75' : ''}`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isRegistering ? 'Submit for Approval' : 'Sign In'} <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => { setError(''); setSuccessMsg(''); setIsRegistering(!isRegistering); }}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium"
            >
              {isRegistering ? 'Already have an account? Log in' : 'New User? Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};