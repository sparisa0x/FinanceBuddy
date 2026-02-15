import React, { useState, useRef, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Lock, User, ArrowRight, ShieldCheck, Mail, CheckCircle, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react';

type ViewMode = 'login' | 'register' | 'otp';

export const Login: React.FC = () => {
  const { login, register, verifyOTP, resendOTP } = useFinance();
  const [view, setView] = useState<ViewMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP State
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // OTP Timer countdown
  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => setOtpTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i];
    setOtpDigits(newDigits);
    if (pasted.length === 6) otpRefs.current[5]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    if (view === 'register') {
      const result = await register(username, password, displayName, email);
      if (!result.success) {
        setError(result.message || 'Registration failed');
      } else if ((result as any).requiresOTP) {
        setView('otp');
        setOtpTimer(60);
        setOtpDigits(['', '', '', '', '', '']);
      } else if (result.message && result.message.includes('wait')) {
        setSuccessMsg(result.message);
        setView('login');
      }
    } else {
      const result = await login(username, password);
      if (!result.success) {
        setError(result.message || 'Invalid username or password');
      }
    }
    setLoading(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    const otp = otpDigits.join('');
    if (otp.length !== 6) { setError('Please enter the 6-digit code'); setLoading(false); return; }
    const result = await verifyOTP(email, otp);
    if (result.success) {
      setSuccessMsg(result.message || 'Email verified! Please wait for admin approval.');
      setView('login');
    } else {
      setError(result.message || 'Verification failed');
    }
    setLoading(false);
  };

  const handleResendOTP = async () => {
    if (otpTimer > 0) return;
    setError('');
    setLoading(true);
    const result = await resendOTP(email);
    if (result.success) {
      setSuccessMsg(result.message || 'New code sent!');
      setOtpTimer(60);
      setOtpDigits(['', '', '', '', '', '']);
    } else {
      setError(result.message || 'Failed to resend');
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md animate-fade-in space-y-8 rounded-2xl bg-slate-900 p-8 shadow-2xl border border-slate-800">
        
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-900/30">
            {view === 'otp' ? <KeyRound className="h-8 w-8 text-indigo-400" /> : <ShieldCheck className="h-8 w-8 text-indigo-400" />}
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            {view === 'otp' ? 'Verify Email' : 'Finance Buddy'}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {view === 'otp' ? `Enter the 6-digit code sent to ${email}` : 'Secure Personal Finance Intelligence'}
          </p>
        </div>

        {/* OTP View */}
        {view === 'otp' && (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyOTP}>
            {successMsg && (
              <div className="rounded-md bg-emerald-900/20 p-4 text-sm text-emerald-300 border border-emerald-900/30 flex gap-2">
                <CheckCircle className="h-5 w-5 shrink-0" /><p>{successMsg}</p>
              </div>
            )}
            <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold rounded-lg border border-slate-700 bg-slate-800 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  autoFocus={i === 0}
                />
              ))}
            </div>
            {error && (<div className="rounded-md bg-rose-900/20 p-3 text-sm text-rose-400 border border-rose-900/30">{error}</div>)}
            <button type="submit" disabled={loading || otpDigits.join('').length !== 6}
              className="group relative flex w-full justify-center rounded-lg bg-indigo-600 py-3 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all">
              {loading ? (<span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>Verifying...</span>)
                : (<span className="flex items-center gap-2">Verify Code <ArrowRight className="h-4 w-4" /></span>)}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { setView('register'); setError(''); setSuccessMsg(''); }} className="text-slate-400 hover:text-white transition-colors">Back to Register</button>
              <button type="button" onClick={handleResendOTP} disabled={otpTimer > 0}
                className={`flex items-center gap-1 font-medium transition-colors ${otpTimer > 0 ? 'text-slate-600 cursor-not-allowed' : 'text-indigo-400 hover:text-indigo-300'}`}>
                <RefreshCw className="h-3.5 w-3.5" />{otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* Login / Register View */}
        {view !== 'otp' && (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {successMsg && (
              <div className="rounded-md bg-emerald-900/20 p-4 text-sm text-emerald-300 border border-emerald-900/30 flex gap-2">
                <CheckCircle className="h-5 w-5 shrink-0" /><p>{successMsg}</p>
              </div>
            )}
            <div className="space-y-4 rounded-md shadow-sm">
              {view === 'register' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">Full Name</label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><User className="h-5 w-5 text-slate-500" /></div>
                      <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                        className="block w-full rounded-lg border border-slate-700 bg-slate-800 py-3 pl-10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Your Name" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Mail className="h-5 w-5 text-slate-500" /></div>
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                        className="block w-full rounded-lg border border-slate-700 bg-slate-800 py-3 pl-10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="Enter valid email for OTP verification" />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Username</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><User className="h-5 w-5 text-slate-500" /></div>
                  <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
                    className="block w-full rounded-lg border border-slate-700 bg-slate-800 py-3 pl-10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter username" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Password</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Lock className="h-5 w-5 text-slate-500" /></div>
                  <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-700 bg-slate-800 py-3 pl-10 pr-10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    placeholder="Enter password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>
            {error && (<div className="rounded-md bg-rose-900/20 p-3 text-sm text-rose-400 border border-rose-900/30">{error}</div>)}
            <div className="flex flex-col gap-3">
              <button type="submit" disabled={loading}
                className={`group relative flex w-full justify-center rounded-lg border border-transparent bg-indigo-600 py-3 px-4 text-sm font-bold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all ${loading ? 'opacity-75' : ''}`}>
                {loading ? (<span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>Processing...</span>)
                  : (<span className="flex items-center gap-2">{view === 'register' ? 'Send Verification Code' : 'Sign In'} <ArrowRight className="h-4 w-4" /></span>)}
              </button>
              <button type="button" onClick={() => { setError(''); setSuccessMsg(''); setView(view === 'register' ? 'login' : 'register'); }}
                className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">
                {view === 'register' ? 'Already have an account? Log in' : 'New User? Create Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};