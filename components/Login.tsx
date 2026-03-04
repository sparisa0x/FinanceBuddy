import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFinance } from '../context/FinanceContext';
import {
  Lock, User, ArrowRight, ShieldCheck, Mail, CheckCircle,
  Eye, EyeOff, KeyRound, RefreshCw, AlertCircle,
} from 'lucide-react';

// ─── View states ─────────────────────────────────────────────────────────────
// 'login'        → email/username + password form
// 'login-otp'   → OTP input after successful password (2FA)
// 'register'     → full registration form
// 'register-otp' → OTP input after signup (email confirmation)
type ViewMode = 'login' | 'login-otp' | 'register' | 'register-otp';

// ─── OTP digit sub-component ─────────────────────────────────────────────────
const OtpInput: React.FC<{
  digits: string[];
  onChange: (i: number, v: string) => void;
  onKeyDown: (i: number, e: React.KeyboardEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
}> = ({ digits, onChange, onKeyDown, onPaste, inputRefs }) => (
  <div className="flex justify-center gap-2 sm:gap-3" onPaste={onPaste}>
    {digits.map((digit, i) => (
      <input
        key={i}
        ref={el => { inputRefs.current[i] = el; }}
        type="text"
        inputMode="numeric"
        maxLength={1}
        value={digit}
        onChange={e => onChange(i, e.target.value)}
        onKeyDown={e => onKeyDown(i, e)}
        className="w-11 h-13 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-lg border border-slate-700 bg-slate-800 text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
        autoFocus={i === 0}
      />
    ))}
  </div>
);

// ─── Component ───────────────────────────────────────────────────────────────
export const Login: React.FC = () => {
  const { login, verifyLoginOTP, register, verifyOTP, resendOTP } = useFinance();

  const [view, setView] = useState<ViewMode>('login');

  // Shared
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register fields
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPw, setRegConfirmPw] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirm, setShowRegConfirm] = useState(false);

  // OTP shared state
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── OTP timer countdown ────────────────────────────────────────────────────
  useEffect(() => {
    if (otpTimer <= 0) return;
    const t = setInterval(() => setOtpTimer(p => p - 1), 1000);
    return () => clearInterval(t);
  }, [otpTimer]);

  // ── OTP helpers ────────────────────────────────────────────────────────────
  const resetOtp = () => {
    setOtpDigits(['', '', '', '', '', '']);
    setOtpTimer(300); // 5 minute display countdown
    setTimeout(() => otpRefs.current[0]?.focus(), 50);
  };

  const handleOtpChange = useCallback((i: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const v = value.slice(-1);
    setOtpDigits(prev => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
  }, []);

  const handleOtpKeyDown = useCallback((i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }, [otpDigits]);

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    if (pasted.length === 6) otpRefs.current[5]?.focus();
  }, []);

  const clearMessages = () => { setError(''); setSuccessMsg(''); };

  // ── Switch views ───────────────────────────────────────────────────────────
  const goTo = (v: ViewMode) => { clearMessages(); setView(v); };

  // ── Submit: Login (step 1 – password) ─────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword) { setError('Please fill in all fields.'); return; }
    clearMessages();
    setLoading(true);

    const result = await login(loginIdentifier.trim(), loginPassword);

    if (!result.success) {
      setError(result.message || 'Login failed.');
      setLoading(false);
    } else if (result.requiresOTP && result.pendingEmail) {
      // Password OK, OTP sent → go to 2FA screen
      setPendingEmail(result.pendingEmail);
      resetOtp();
      setLoading(false);
      setView('login-otp');
    }
    // On unexpected success without OTP (shouldn't happen), keep loading
    // so onAuthStateChange can flip isAuthenticated and unmount this component
  };

  // ── Submit: Login OTP (step 2 – 2FA) ──────────────────────────────────────
  const handleLoginOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    clearMessages();
    setLoading(true);

    const result = await verifyLoginOTP(pendingEmail, otp);
    if (!result.success) {
      setError(result.message || 'Verification failed.');
      setLoading(false);
    }
    // On success: keep loading; onAuthStateChange sets isAuthenticated → dashboard shows
  };

  // ── Submit: Register ───────────────────────────────────────────────────────
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    // Client-side validations
    if (!regFullName.trim()) { setError('Please enter your full name.'); return; }
    if (!regEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setError('Please enter a valid email address.'); return;
    }
    if (!regUsername.trim() || regUsername.length < 3) {
      setError('Username must be at least 3 characters.'); return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(regUsername.trim())) {
      setError('Username can only contain letters, numbers, and underscores.'); return;
    }
    if (regPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (regPassword !== regConfirmPw) { setError('Passwords do not match.'); return; }

    setLoading(true);
    const result = await register(regUsername.trim(), regPassword, regFullName.trim(), regEmail.trim());

    if (!result.success) {
      setError(result.message || 'Registration failed.');
      setLoading(false);
    } else if (result.requiresOTP) {
      // Email OTP sent for confirmation
      setPendingEmail(result.pendingEmail || regEmail.trim().toLowerCase());
      resetOtp();
      setLoading(false);
      setView('register-otp');
    } else if (result.message?.toLowerCase().includes('approval') || result.message?.toLowerCase().includes('wait')) {
      // Auto-confirmed but pending admin approval
      setSuccessMsg(result.message ?? '');
      setView('login');
      setLoading(false);
    }
    // On success without OTP: onAuthStateChange handles it
  };

  // ── Submit: Register OTP ───────────────────────────────────────────────────
  const handleRegisterOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length !== 6) { setError('Please enter the 6-digit code.'); return; }
    clearMessages();
    setLoading(true);

    const result = await verifyOTP(pendingEmail, otp);
    if (!result.success) {
      setError(result.message || 'Verification failed.');
      setLoading(false);
    } else if (result.message?.toLowerCase().includes('pending') || result.message?.toLowerCase().includes('approval')) {
      setSuccessMsg(result.message ?? '');
      setView('login');
      setLoading(false);
    }
    // On approved: onAuthStateChange → dashboard
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (otpTimer > 0) return;
    clearMessages();
    setLoading(true);
    const flow: 'login' | 'signup' = view === 'login-otp' ? 'login' : 'signup';
    const result = await resendOTP(pendingEmail, flow);
    if (result.success) {
      setSuccessMsg('New verification code sent!');
      resetOtp();
    } else {
      setError(result.message || 'Failed to resend.');
    }
    setLoading(false);
  };

  // ── Format timer ───────────────────────────────────────────────────────────
  const formatTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const isOtpView = view === 'login-otp' || view === 'register-otp';

  const headerTitle = {
    'login': 'Finance Buddy',
    'login-otp': 'Verify Identity',
    'register': 'Create Account',
    'register-otp': 'Verify Email',
  }[view];

  const headerSub = {
    'login': 'Secure Personal Finance Intelligence',
    'login-otp': `Enter the 6-digit code sent to ${pendingEmail}`,
    'register': 'Join Finance Buddy today',
    'register-otp': `Enter the 6-digit code sent to ${pendingEmail}`,
  }[view];

  const pwStrength = (pw: string) => {
    if (!pw) return null;
    const strong = pw.length >= 12 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw);
    const medium = pw.length >= 8;
    return strong ? { label: 'Strong', color: 'text-emerald-400' }
      : medium   ? { label: 'Medium', color: 'text-amber-400' }
                 : { label: 'Weak',   color: 'text-rose-400' };
  };

  const inputBase = 'block w-full rounded-lg border border-slate-700 bg-slate-800 py-3 pl-10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm';

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-md animate-fade-in space-y-6 rounded-2xl bg-slate-900 p-8 shadow-2xl border border-slate-800">

        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-900/30">
            {isOtpView ? <KeyRound className="h-8 w-8 text-indigo-400" /> : <ShieldCheck className="h-8 w-8 text-indigo-400" />}
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-white">{headerTitle}</h2>
          <p className="mt-1 text-sm text-slate-400">{headerSub}</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex gap-2 rounded-lg border border-rose-900/30 bg-rose-900/20 p-3 text-sm text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><p>{error}</p>
          </div>
        )}
        {successMsg && (
          <div className="flex gap-2 rounded-lg border border-emerald-900/30 bg-emerald-900/20 p-3 text-sm text-emerald-300">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /><p>{successMsg}</p>
          </div>
        )}

        {/* ── LOGIN FORM ─────────────────────────────────────────────────────── */}
        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Email or Username</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><User className="h-5 w-5 text-slate-500" /></div>
                <input type="text" required autoComplete="username" value={loginIdentifier} onChange={e => setLoginIdentifier(e.target.value)}
                  className={inputBase} placeholder="Enter email or username" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Lock className="h-5 w-5 text-slate-500" /></div>
                <input type={showLoginPw ? 'text' : 'password'} required autoComplete="current-password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                  className={`${inputBase} pr-10`} placeholder="Enter password" />
                <button type="button" onClick={() => setShowLoginPw(v => !v)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition-colors">
                  {showLoginPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="pt-1 space-y-2">
              <button type="submit" disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all">
                {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Verifying...</>
                  : <>Sign In <ArrowRight className="h-4 w-4" /></>}
              </button>
              <p className="text-center text-sm text-slate-400">
                After sign-in you'll receive a{' '}
                <span className="font-medium text-indigo-400">one-time verification code</span> for security.
              </p>
              <button type="button" onClick={() => goTo('register')} className="w-full text-center text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                New here? Create an account
              </button>
            </div>
          </form>
        )}

        {/* ── LOGIN OTP FORM ─────────────────────────────────────────────────── */}
        {view === 'login-otp' && (
          <form onSubmit={handleLoginOtpSubmit} className="space-y-5">
            <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-xs text-slate-400 text-center">
              A 6-digit code was sent to <span className="font-semibold text-slate-200">{pendingEmail}</span>.
              It expires in <span className="text-indigo-400 font-semibold">5 minutes</span>.
            </div>

            <OtpInput digits={otpDigits} onChange={handleOtpChange} onKeyDown={handleOtpKeyDown} onPaste={handleOtpPaste} inputRefs={otpRefs} />

            <button type="submit" disabled={loading || otpDigits.join('').length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all">
              {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Verifying...</>
                : <>Verify &amp; Sign In <ArrowRight className="h-4 w-4" /></>}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { clearMessages(); setView('login'); }}
                className="text-slate-400 hover:text-white transition-colors">← Back to login</button>
              <button type="button" disabled={otpTimer > 0} onClick={handleResend}
                className={`flex items-center gap-1 font-medium transition-colors ${otpTimer > 0 ? 'text-slate-600 cursor-not-allowed' : 'text-indigo-400 hover:text-indigo-300'}`}>
                <RefreshCw className="h-3.5 w-3.5" />
                {otpTimer > 0 ? `Resend in ${formatTimer(otpTimer)}` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}

        {/* ── REGISTER FORM ─────────────────────────────────────────────────── */}
        {view === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Full Name</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><User className="h-5 w-5 text-slate-500" /></div>
                <input type="text" required autoComplete="name" value={regFullName} onChange={e => setRegFullName(e.target.value)}
                  className={inputBase} placeholder="Your full name" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Mail className="h-5 w-5 text-slate-500" /></div>
                <input type="email" required autoComplete="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  className={inputBase} placeholder="you@example.com" />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Username</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-slate-500 text-sm font-medium">@</span>
                </div>
                <input type="text" required autoComplete="username" value={regUsername}
                  onChange={e => setRegUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className={inputBase} placeholder="letters, numbers, underscores" minLength={3} maxLength={30} />
              </div>
              {regUsername && regUsername.length < 3 && (
                <p className="mt-1 text-xs text-amber-400">Minimum 3 characters.</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Lock className="h-5 w-5 text-slate-500" /></div>
                <input type={showRegPw ? 'text' : 'password'} required autoComplete="new-password"
                  value={regPassword} onChange={e => setRegPassword(e.target.value)}
                  className={`${inputBase} pr-10`} placeholder="Min 8 characters" minLength={8} />
                <button type="button" onClick={() => setShowRegPw(v => !v)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition-colors">
                  {showRegPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {regPassword && (() => { const s = pwStrength(regPassword); return s ? <p className={`mt-1 text-xs font-medium ${s.color}`}>Strength: {s.label}</p> : null; })()}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Confirm Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Lock className="h-5 w-5 text-slate-500" /></div>
                <input type={showRegConfirm ? 'text' : 'password'} required autoComplete="new-password"
                  value={regConfirmPw} onChange={e => setRegConfirmPw(e.target.value)}
                  className={`${inputBase} pr-10`} placeholder="Repeat password" />
                <button type="button" onClick={() => setShowRegConfirm(v => !v)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition-colors">
                  {showRegConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {regConfirmPw && regPassword !== regConfirmPw && (
                <p className="mt-1 text-xs text-rose-400">Passwords do not match.</p>
              )}
            </div>

            <div className="pt-1 space-y-2">
              <button type="submit" disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all">
                {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Creating account...</>
                  : <>Send Verification Code <ArrowRight className="h-4 w-4" /></>}
              </button>
              <button type="button" onClick={() => goTo('login')} className="w-full text-center text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {/* ── REGISTER OTP FORM ─────────────────────────────────────────────── */}
        {view === 'register-otp' && (
          <form onSubmit={handleRegisterOtpSubmit} className="space-y-5">
            <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3 text-xs text-slate-400 text-center">
              A verification code was sent to <span className="font-semibold text-slate-200">{pendingEmail}</span>.
              It expires in <span className="text-indigo-400 font-semibold">5 minutes</span>.
            </div>

            <OtpInput digits={otpDigits} onChange={handleOtpChange} onKeyDown={handleOtpKeyDown} onPaste={handleOtpPaste} inputRefs={otpRefs} />

            <button type="submit" disabled={loading || otpDigits.join('').length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all">
              {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Verifying...</>
                : <>Verify Email <ArrowRight className="h-4 w-4" /></>}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => { clearMessages(); setView('register'); }}
                className="text-slate-400 hover:text-white transition-colors">← Back to register</button>
              <button type="button" disabled={otpTimer > 0} onClick={handleResend}
                className={`flex items-center gap-1 font-medium transition-colors ${otpTimer > 0 ? 'text-slate-600 cursor-not-allowed' : 'text-indigo-400 hover:text-indigo-300'}`}>
                <RefreshCw className="h-3.5 w-3.5" />
                {otpTimer > 0 ? `Resend in ${formatTimer(otpTimer)}` : 'Resend Code'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
