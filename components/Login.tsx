import React, { useState, useRef } from 'react';
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { useAuth } from '@clerk/react';
import { useFinance } from '../context/FinanceContext';
import { Lock, User, Mail, ArrowRight, ShieldCheck, AlertCircle, CheckCircle, Eye, EyeOff, KeyRound, RotateCcw, Clock } from 'lucide-react';

type AuthView = 'login' | 'register' | 'verifyEmail' | 'verifyLoginOtp' | 'pendingApproval';
type LoginOtpStrategy = 'email_code' | 'phone_code' | 'totp';

export const Login: React.FC<{ onBackHome?: () => void }> = ({ onBackHome }) => {
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const { signOut } = useAuth();
  const { ensureProfile } = useFinance();

  const [view, setView] = useState<AuthView>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [loginOtpStrategy, setLoginOtpStrategy] = useState<LoginOtpStrategy | null>(null);
  const [loginOtpHint, setLoginOtpHint] = useState('email');

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
  const [otpCode, setOtpCode] = useState('');
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Store registration data for profile creation
  const regDataRef = useRef({ name: '', username: '', email: '' });

  const clearMessages = () => { setError(''); setSuccess(''); };

  const startRateLimitCooldown = () => {
    setRateLimited(true);
    setCooldownSeconds(60);
    setError('Too many login attempts. Please wait 60 seconds before trying again.');

    const timer = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setRateLimited(false);
          setError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const switchView = (nextView: AuthView) => {
    clearMessages();
    setView(nextView);
    setShowPassword(false);
    setShowRegPassword(false);
    setShowConfirmPassword(false);
    setOtpCode('');
    if (nextView === 'login') {
      setLoginOtpStrategy(null);
      setLoginOtpHint('email');
    }
  };

  // ── Login handler ─────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!identifier.trim() || !password.trim()) {
      setError('Please enter username/email and password.');
      return;
    }

    if (!signInLoaded || !signIn) return;

    setLoading(true);
    try {
      const result = await signIn.create({
        identifier: identifier.trim(),
        password,
      });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        setSuccess('Login successful. Loading your data...');
      } else if (result.status === 'needs_second_factor') {
        const emailFactor = result.supportedSecondFactors?.find(
          (f: any) => f.strategy === 'email_code'
        );
        const phoneFactor = result.supportedSecondFactors?.find(
          (f: any) => f.strategy === 'phone_code'
        );
        const totpFactor = result.supportedSecondFactors?.find(
          (f: any) => f.strategy === 'totp'
        );

        if (emailFactor) {
          await signIn.prepareSecondFactor({ strategy: 'email_code' });
          setLoginOtpStrategy('email_code');
          setLoginOtpHint('email');
          setSuccess('Verification code sent to your email.');
          setView('verifyLoginOtp');
        } else if (phoneFactor) {
          await signIn.prepareSecondFactor({ strategy: 'phone_code' });
          setLoginOtpStrategy('phone_code');
          setLoginOtpHint('phone');
          setSuccess('Verification code sent to your phone.');
          setView('verifyLoginOtp');
        } else if (totpFactor) {
          setLoginOtpStrategy('totp');
          setLoginOtpHint('authenticator app');
          setSuccess('Enter the code from your authenticator app.');
          setView('verifyLoginOtp');
        } else {
          setError('Second-factor authentication is required, but no supported method is available.');
        }
      } else if (result.status === 'needs_first_factor') {
        setError('Additional verification required. Please check your email.');
      }
    } catch (err: any) {
      const msg = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || 'Login failed.';
      if (msg.toLowerCase().includes('too many requests') || err.status === 429) {
        startRateLimitCooldown();
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Login OTP verification handler ────────────────────────────────────────
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (!signInLoaded || !signIn || !loginOtpStrategy) {
      setError('Verification session expired. Please sign in again.');
      setView('login');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: loginOtpStrategy,
        code: otpCode.trim(),
      });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });
        setSuccess('Login successful. Loading your data...');
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      const msg = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || 'Verification failed.';
      if (msg.toLowerCase().includes('too many requests') || err.status === 429) {
        startRateLimitCooldown();
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
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
    if (!signUpLoaded || !signUp) return;

    setLoading(true);
    try {
      // Store registration data for profile creation after OTP
      regDataRef.current = {
        name: name.trim(),
        username: username.trim(),
        email: email.trim().toLowerCase(),
      };

      // Split name into first/last for Clerk
      const parts = name.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : undefined;

      await signUp.create({
        emailAddress: email.trim().toLowerCase(),
        password: regPassword,
        username: username.trim().toLowerCase(),
        firstName,
        lastName,
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      setSuccess('Verification code sent to your email.');
      setView('verifyEmail');
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (err: any) {
      const msg = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || 'Registration failed.';
      if (msg.toLowerCase().includes('too many requests') || err.status === 429) {
        startRateLimitCooldown();
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Email OTP verification handler ────────────────────────────────────────
  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (!signUpLoaded || !signUp) return;

    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: otpCode.trim(),
      });

      if (result.status === 'complete') {
        // Activate the session briefly so we can create the Supabase profile
        await setSignUpActive({ session: result.createdSessionId });

        // Create the Supabase profile (status: pending for normal users)
        const { name: regName, username: regUsername, email: regEmail } = regDataRef.current;
        await ensureProfile(regName, regUsername, regEmail);

        // Sign out: user must log in again after admin approval
        await signOut();

        setSuccess('Email verified! Your account is awaiting admin approval. You will be able to login once approved.');
        setView('pendingApproval');
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      const msg = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || err.message || 'Verification failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP handler ────────────────────────────────────────────────────
  const [resending, setResending] = useState(false);
  const handleResendOTP = async () => {
    clearMessages();
    if (!signUpLoaded || !signUp) return;
    setResending(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setSuccess('New verification code sent!');
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
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
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1 mb-2"
          >
            <ArrowRight className="h-4 w-4 rotate-180" /> Back to home
          </button>
        )}

        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <div className="text-center">
          <div className="mx-auto h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg mb-4">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            {view === 'login' && 'Welcome Back'}
            {view === 'register' && 'Create Account'}
            {view === 'verifyEmail' && 'Verify Email'}
            {view === 'verifyLoginOtp' && 'Verify Sign In'}
            {view === 'pendingApproval' && 'Almost There!'}
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {view === 'login' && 'Sign in to access your finance dashboard'}
            {view === 'register' && 'Start managing your finances securely'}
            {view === 'verifyEmail' && 'Enter the code sent to your email'}
            {view === 'verifyLoginOtp' && `Enter the code sent to your ${loginOtpHint}`}
            {view === 'pendingApproval' && 'Your account is under review'}
          </p>
        </div>

        {/* ── Messages ──────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-lg border border-rose-900/30 bg-rose-900/20 p-3 flex items-center gap-2 text-sm text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <div className="flex-1">
              {error}
              {rateLimited && cooldownSeconds > 0 && (
                <div className="mt-1 text-xs text-rose-300">
                  Retry available in {cooldownSeconds}s
                </div>
              )}
            </div>
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-900/30 bg-emerald-900/20 p-3 flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle className="h-4 w-4 shrink-0" /> {success}
          </div>
        )}

        {/* ── Login Form ────────────────────────────────────────────────── */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="text" placeholder="Username or Email" value={identifier}
                onChange={e => setIdentifier(e.target.value)} className={inputBase} autoFocus
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'} placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)} className={passwordInputBase}
              />
              <EyeToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
            </div>
            <button type="submit" disabled={loading || rateLimited}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? (
                <>
                  <RotateCcw className="h-4 w-4 animate-spin" /> Signing in...
                </>
              ) : rateLimited ? (
                <>
                  <Clock className="h-4 w-4" /> Wait {cooldownSeconds}s
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" /> Sign In
                </>
              )}
            </button>
            <p className="text-center text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <button type="button" onClick={() => switchView('register')} className="text-indigo-400 hover:text-indigo-300 font-medium">
                Register
              </button>
            </p>
          </form>
        )}

        {/* ── Register Form ─────────────────────────────────────────────── */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input type="text" placeholder="Full Name" value={name}
                onChange={e => setName(e.target.value)} className={inputBase} autoFocus />
            </div>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)} className={inputBase} />
            </div>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input type="text" placeholder="Username" value={username}
                onChange={e => setUsername(e.target.value)} className={inputBase} />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input type={showRegPassword ? 'text' : 'password'} placeholder="Password (min 8 chars)" value={regPassword}
                onChange={e => setRegPassword(e.target.value)} className={passwordInputBase} />
              <EyeToggle show={showRegPassword} onToggle={() => setShowRegPassword(!showRegPassword)} />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm Password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} className={passwordInputBase} />
              <EyeToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} />
            </div>
            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 shadow-lg transition-all disabled:opacity-50">
              {loading ? <RotateCcw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Registering...' : 'Create Account'}
            </button>
            <p className="text-center text-sm text-slate-500">
              Already have an account?{' '}
              <button type="button" onClick={() => switchView('login')} className="text-indigo-400 hover:text-indigo-300 font-medium">
                Sign In
              </button>
            </p>
          </form>
        )}

        {/* ── Email OTP Verification ────────────────────────────────────── */}
        {view === 'verifyEmail' && (
          <form onSubmit={handleVerifyEmail} className="space-y-4">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input
                ref={otpInputRef}
                type="text" placeholder="Enter 6-digit code" value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={inputBase} maxLength={6} autoFocus inputMode="numeric"
              />
            </div>
            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 shadow-lg transition-all disabled:opacity-50">
              {loading ? <RotateCcw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={handleResendOTP} disabled={resending}
                className="text-indigo-400 hover:text-indigo-300 disabled:opacity-50">
                {resending ? 'Resending...' : 'Resend Code'}
              </button>
              <button type="button" onClick={() => switchView('register')}
                className="text-slate-400 hover:text-white">
                Back
              </button>
            </div>
          </form>
        )}

        {/* ── Login OTP Verification ────────────────────────────────────── */}
        {view === 'verifyLoginOtp' && (
          <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Enter 6-digit code"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={inputBase}
                maxLength={6}
                autoFocus
                inputMode="numeric"
              />
            </div>
            <button type="submit" disabled={loading || rateLimited}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <RotateCcw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={() => switchView('login')}
                className="text-slate-400 hover:text-white">
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* ── Pending Approval ──────────────────────────────────────────── */}
        {view === 'pendingApproval' && (
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-full bg-amber-900/30 flex items-center justify-center">
              <ShieldCheck className="h-8 w-8 text-amber-400" />
            </div>
            <p className="text-slate-300">
              Your account has been created and your email is verified.
              An administrator will review your registration shortly.
            </p>
            <p className="text-slate-500 text-sm">
              Once approved, you can sign in with your credentials.
            </p>
            <button type="button" onClick={() => switchView('login')}
              className="w-full rounded-lg bg-slate-800 py-3 font-semibold text-white hover:bg-slate-700 transition-colors">
              Go to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
