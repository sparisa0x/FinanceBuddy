import React, { useState, useRef } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Lock, User, Mail, ArrowRight, ShieldCheck, AlertCircle, CheckCircle, Eye, EyeOff, KeyRound, RotateCcw } from 'lucide-react';

type AuthView = 'login' | 'register' | 'otp';

export const Login: React.FC<{ onBackHome?: () => void }> = ({ onBackHome }) => {
  const { login, register, verifyLoginOTP, resendOTP } = useFinance();

  const [view, setView] = useState<AuthView>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP fields
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingFlow, setPendingFlow] = useState<'login' | 'signup'>('login');
  const [otpCode, setOtpCode] = useState('');
  const [resending, setResending] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const switchView = (nextView: AuthView) => {
    clearMessages();
    setView(nextView);
    setShowPassword(false);
    setShowRegPassword(false);
    setShowConfirmPassword(false);
    setOtpCode('');
  };

  // ── Login handler ─────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!identifier.trim() || !password.trim()) {
      setError('Please enter username/email and password.');
      return;
    }

    setLoading(true);
    const result = await login(identifier.trim(), password);
    setLoading(false);

    if (!result.success) {
      setError(result.message || 'Login failed.');
      return;
    }

    if (result.requiresOTP && result.pendingEmail) {
      // Password verified → OTP sent → switch to OTP view
      setPendingEmail(result.pendingEmail);
      setPendingFlow('login');
      setOtpCode('');
      setSuccess('Verification code sent to your email.');
      setView('otp');
      setTimeout(() => otpInputRef.current?.focus(), 100);
      return;
    }

    setSuccess('Login successful. Redirecting...');
  };

  // ── Register handler ──────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!name.trim() || !email.trim() || !username.trim() || !regPassword.trim()) {
      setError('Please complete all fields.');
      return;
    }

    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (regPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await register(username.trim(), regPassword, name.trim(), email.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.message || 'Registration failed.');
      return;
    }

    if (result.requiresOTP && result.pendingEmail) {
      // Account created → OTP sent → switch to OTP view for email verification
      setPendingEmail(result.pendingEmail);
      setPendingFlow('signup');
      setOtpCode('');
      setSuccess(result.message || 'Verification code sent to your email.');
      setView('otp');
      setTimeout(() => otpInputRef.current?.focus(), 100);
      return;
    }

    // Fallback: no OTP but still successful
    setSuccess(result.message || 'Registration submitted. Your account is waiting for admin approval.');
    setName('');
    setEmail('');
    setUsername('');
    setRegPassword('');
    setConfirmPassword('');
    setView('login');
  };

  // ── OTP verify handler ────────────────────────────────────────────────────
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    const result = await verifyLoginOTP(pendingEmail, otpCode.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.message || 'Verification failed.');
      return;
    }

    if (result.message) {
      // E.g. "Email verified! Pending admin approval" — show message then go to login
      setSuccess(result.message);
      setTimeout(() => {
        setOtpCode('');
        switchView('login');
      }, 3000);
      return;
    }

    // Fully logged in
    setSuccess('Verified! Redirecting...');
  };

  // ── Resend OTP handler ────────────────────────────────────────────────────
  const handleResendOTP = async () => {
    clearMessages();
    setResending(true);
    const result = await resendOTP(pendingEmail, pendingFlow);
    setResending(false);

    if (!result.success) {
      setError(result.message || 'Failed to resend code.');
      return;
    }
    setSuccess(result.message || 'New verification code sent!');
  };

  const inputBase = 'block w-full rounded-lg border border-slate-700 bg-slate-800 py-3 pl-10 pr-3 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm';
  const passwordInputBase = 'block w-full rounded-lg border border-slate-700 bg-slate-800 py-3 pl-10 pr-10 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm';

  const EyeToggle: React.FC<{ show: boolean; onToggle: () => void }> = ({ show, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 transition-colors"
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-md animate-fade-in space-y-6 rounded-2xl bg-slate-900 p-8 shadow-2xl border border-slate-800">
        {onBackHome && (
          <button
            type="button"
            onClick={onBackHome}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            &larr; Back to Home
          </button>
        )}

        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-900/30">
            <ShieldCheck className="h-8 w-8 text-indigo-400" />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-white">FinanceBuddy</h2>
          <p className="mt-1 text-sm text-slate-400">
            {view === 'login' ? 'Secure sign in to your account' : view === 'register' ? 'Create account and wait for admin approval' : 'Enter the verification code sent to your email'}
          </p>
        </div>

        {error && (
          <div className="flex gap-2 rounded-lg border border-rose-900/30 bg-rose-900/20 p-3 text-sm text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="flex gap-2 rounded-lg border border-emerald-900/30 bg-emerald-900/20 p-3 text-sm text-emerald-300">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{success}</p>
          </div>
        )}

        {view === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Email or Username</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><User className="h-5 w-5 text-slate-500" /></div>
                <input
                  title="Email or Username"
                  type="text"
                  required
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={inputBase}
                  placeholder="Enter email or username"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Lock className="h-5 w-5 text-slate-500" /></div>
                <input
                  title="Password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={passwordInputBase}
                  placeholder="Enter password"
                />
                <EyeToggle show={showPassword} onToggle={() => setShowPassword(v => !v)} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Verifying...' : <>Sign In <ArrowRight className="h-4 w-4" /></>}
            </button>

            <button
              type="button"
              onClick={() => switchView('register')}
              className="w-full text-center text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              New here? Create an account
            </button>
          </form>
        ) : view === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Full Name</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><User className="h-5 w-5 text-slate-500" /></div>
                <input
                  title="Full Name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputBase}
                  placeholder="Your full name"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Mail className="h-5 w-5 text-slate-500" /></div>
                <input
                  title="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputBase}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Username</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><User className="h-5 w-5 text-slate-500" /></div>
                <input
                  title="Username"
                  type="text"
                  required
                  minLength={3}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  className={inputBase}
                  placeholder="letters, numbers, underscores"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Lock className="h-5 w-5 text-slate-500" /></div>
                <input
                  title="Registration Password"
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className={passwordInputBase}
                  placeholder="Min 8 characters"
                />
                <EyeToggle show={showRegPassword} onToggle={() => setShowRegPassword(v => !v)} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Confirm Password</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><Lock className="h-5 w-5 text-slate-500" /></div>
                <input
                  title="Confirm Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={passwordInputBase}
                  placeholder="Repeat password"
                />
                <EyeToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword(v => !v)} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Creating account...' : <>Register <ArrowRight className="h-4 w-4" /></>}
            </button>

            <button
              type="button"
              onClick={() => switchView('login')}
              className="w-full text-center text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Already have an account? Sign in
            </button>
          </form>
        ) : (
          /* ── OTP Verification View ──────────────────────────────────────── */
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-900/30 mb-3">
                <KeyRound className="h-6 w-6 text-indigo-400" />
              </div>
              <p className="text-sm text-slate-400">
                We sent a 6-digit code to <span className="font-semibold text-indigo-300">{pendingEmail}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Check your inbox (and spam folder).</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Verification Code</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"><KeyRound className="h-5 w-5 text-slate-500" /></div>
                <input
                  ref={otpInputRef}
                  title="Verification Code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={inputBase}
                  placeholder="Enter 6-digit code"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.trim().length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 px-4 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Verifying...' : <>Verify Code <ArrowRight className="h-4 w-4" /></>}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={resending}
                className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium transition-colors disabled:opacity-50"
              >
                <RotateCcw className={`h-3.5 w-3.5 ${resending ? 'animate-spin' : ''}`} />
                {resending ? 'Sending...' : 'Resend Code'}
              </button>

              <button
                type="button"
                onClick={() => switchView(pendingFlow === 'login' ? 'login' : 'register')}
                className="text-slate-400 hover:text-slate-300 transition-colors"
              >
                &larr; Go back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
