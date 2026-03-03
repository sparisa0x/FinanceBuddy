import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MAX_ATTEMPTS = 3;

const VerifyOtp: React.FC = () => {
  const location     = useLocation();
  const navigate     = useNavigate();
  const { verifyOtp, resendOtp, user } = useAuth();

  // Guard: redirect if navigated here directly without email
  const state = location.state as { email?: string; type?: 'signup' | 'email' } | null;
  const email = state?.email ?? '';
  const otpType: 'signup' | 'email' = state?.type ?? 'email';

  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const [digits,   setDigits]   = useState(['', '', '', '', '', '']);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [timer,    setTimer]    = useState(60);
  const [attempts, setAttempts] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const token = digits.join('');
    if (token.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    const { error: err } = await verifyOtp(email, token, otpType);

    if (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        navigate('/login', { replace: true });
        return;
      }

      const invalidToken = /invalid|expired/i.test(err);
      const baseMessage = invalidToken
        ? 'Invalid/expired code. If your email says "Magic Link", click the login link in that email instead of entering digits.'
        : err;

      setError(`${baseMessage} (${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts !== 1 ? 's' : ''} remaining)`);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } else {
      navigate('/dashboard', { replace: true });
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (timer > 0) return;
    setError('');
    const { error: err } = await resendOtp(email, otpType);
    if (err) {
      setError(err);
    } else {
      setTimer(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="rounded-xl bg-indigo-600 p-2.5">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">FinanceBuddy</span>
        </div>

        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-xl">
          <h1 className="text-xl font-bold text-white mb-2">Verify your email</h1>
          <p className="text-slate-400 text-sm mb-1">
            We sent a 6-digit code to
          </p>
          <p className="text-indigo-400 text-sm font-medium mb-6 truncate">{email}</p>
          <p className="text-xs text-slate-500 mb-4">
            If you received a <strong>Magic Link</strong> email, open that link to complete login.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleVerify}>
            {/* 6 digit boxes */}
            <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  title={`OTP digit ${i + 1}`}
                  aria-label={`OTP digit ${i + 1}`}
                  className="w-11 h-14 rounded-xl bg-slate-800 border border-slate-700 text-center text-xl font-bold text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || digits.join('').length !== 6}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</>
              ) : (
                'Verify Code'
              )}
            </button>
          </form>

          {/* Resend */}
          <div className="mt-4 text-center">
            {timer > 0 ? (
              <p className="text-sm text-slate-500">
                Resend in <span className="text-slate-300 font-medium">0:{String(timer).padStart(2, '0')}</span>
              </p>
            ) : (
              <button
                onClick={handleResend}
                className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
              >
                Resend OTP
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
