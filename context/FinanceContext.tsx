import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Transaction, Debt, Investment, WishlistItem, FinancialHealth } from '../types';
import { supabase } from '../lib/supabase';

// ─── Context Interface ───────────────────────────────────────────────────────
interface AuthResult { success: boolean; message?: string; requiresOTP?: boolean; pendingEmail?: string; }

interface FinanceContextType {
  transactions: Transaction[];
  debts: Debt[];
  investments: Investment[];
  wishlist: WishlistItem[];
  currency: string;
  userName: string;
  setUserName: (name: string) => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  addDebt: (d: Omit<Debt, 'id' | 'remainingAmount'>) => void;
  updateDebt: (id: string, d: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;
  payEMI: (debtId: string, amount: number) => void;
  addInvestment: (i: Omit<Investment, 'id'>) => void;
  addToWishlist: (w: Omit<WishlistItem, 'id' | 'status' | 'viewCount'>) => void;
  updateWishlistItem: (id: string, updates: Partial<WishlistItem>) => void;
  deleteWishlistItem: (id: string) => void;
  healthScore: FinancialHealth;
  netWorth: number;
  totalDebt: number;
  monthlyEMI: number;
  creditScores: { cibil: number; experian: number };
  updateCreditScores: (scores: { cibil: number; experian: number }) => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  // login: verify password → sign out → send email OTP → returns requiresOTP:true
  login: (identifier: string, password: string) => Promise<AuthResult>;
  // verifyLoginOTP: called after login OTP input
  verifyLoginOTP: (email: string, otp: string) => Promise<AuthResult>;
  // register: creates account → sends signup OTP → returns requiresOTP:true
  register: (username: string, password: string, name: string, email: string) => Promise<AuthResult>;
  // verifyOTP: called after signup OTP input
  verifyOTP: (email: string, otp: string) => Promise<AuthResult>;
  resendOTP: (email: string, flow: 'login' | 'signup') => Promise<AuthResult>;
  requestPasswordResetOTP: (identifier: string) => Promise<AuthResult>;
  verifyPasswordResetOTP: (email: string, otp: string, newPassword: string) => Promise<AuthResult>;
  changePassword: (newPass: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isCloudConnected: boolean;
  authUsername: string;
  userEmail: string;

  // Admin
  pendingUsers: any[];
  fetchPendingUsers: () => Promise<void>;
  approveUser: (profileId: string) => Promise<boolean>;
  rejectUser: (profileId: string) => Promise<boolean>;
}

// ─── DB ↔ Frontend mappers (snake_case → camelCase) ──────────────────────────
const dbToTransaction = (r: any): Transaction => ({
  id: r.id,
  amount: Number(r.amount),
  type: r.type,
  category: r.category,
  date: r.date,
  description: r.description ?? '',
});

const dbToDebt = (r: any): Debt => ({
  id: r.id,
  name: r.name,
  type: r.type,
  totalAmount: Number(r.total_amount),
  remainingAmount: Number(r.remaining_amount),
  interestRate: Number(r.interest_rate),
  monthlyEMI: Number(r.monthly_emi),
  dueDate: Number(r.due_date),
  isPaused: Boolean(r.is_paused),
});

const dbToInvestment = (r: any): Investment => ({
  id: r.id,
  name: r.name,
  type: r.type,
  investedAmount: Number(r.invested_amount),
  currentValue: Number(r.current_value),
  lastUpdated: r.last_updated ?? new Date().toISOString().split('T')[0],
  goalName: r.goal_name ?? '',
  targetValue: Number(r.target_value ?? 0),
  expectedAnnualReturn: Number(r.expected_annual_return ?? 0),
  tenureMonths: Number(r.tenure_months ?? 0),
  monthlyContribution: Number(r.monthly_contribution ?? 0),
  interestRate: Number(r.interest_rate ?? 0),
  riskLevel: r.risk_level ?? 'medium',
  notes: r.notes ?? '',
});

const dbToWishlistItem = (r: any): WishlistItem => ({
  id: r.id,
  name: r.name,
  category: r.category ?? 'want',
  estimatedCost: Number(r.estimated_cost),
  priority: r.priority ?? 'medium',
  status: r.status ?? 'added',
  viewCount: Number(r.view_count ?? 0),
});

/**
 * Resolve the effective approval status from BOTH the new `status` column
 * and the legacy `approval_status` column.  We CANNOT use `??` because the
 * `status` column has DEFAULT 'pending' — it is never null, so `??` always
 * picks 'pending' even when `approval_status` is 'approved'.
 *
 * Priority: if EITHER column says 'approved' or 'rejected', honour it.
 */
const resolveProfileStatus = (profile: any): 'pending' | 'approved' | 'rejected' => {
  const s  = profile?.status         as string | null | undefined;
  const as_ = profile?.approval_status as string | null | undefined;

  // Prefer explicit 'approved'/'rejected' from the canonical `status` column
  if (s === 'approved' || s === 'rejected') return s;
  // Fall back to the legacy `approval_status` column
  if (as_ === 'approved' || as_ === 'rejected') return as_;
  // Default
  return 'pending';
};

// ─── Context ─────────────────────────────────────────────────────────────────
const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
  const LAST_ACTIVITY_AT_KEY = 'financebuddy_last_activity_at';

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(true);

  const logoutInProgressRef = useRef(false);
  const loginInProgressRef  = useRef(false);   // gates syncAuthState during login()
  const isAuthenticatedRef  = useRef(false);   // mirrors state for stale-closure reads
  const currentUserIdRef    = useRef('');       // mirrors state for stale-closure reads
  const lastActivityAtRef   = useRef<number>(Date.now());

  // Admin
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [creditScores, setCreditScores] = useState({ cibil: 0, experian: 0 });

  const [healthScore, setHealthScore] = useState<FinancialHealth>({
    score: 0, status: 'Warning', color: '#f59e0b',
    factors: { savingsRate: 0, debtBurden: 0, emergencyCoverage: 0 },
  });

  const [userName, setUserNameState] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const currency = '₹';

  const LOCAL_SNAPSHOT_PREFIX = 'financebuddy_snapshot_v1_';

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const getSnapshotKey = (userId: string) => `${LOCAL_SNAPSHOT_PREFIX}${userId}`;

  const readLocalSnapshot = (userId: string) => {
    try {
      const raw = localStorage.getItem(getSnapshotKey(userId));
      if (!raw) return null;
      return JSON.parse(raw) as {
        transactions: Transaction[];
        debts: Debt[];
        investments: Investment[];
        wishlist: WishlistItem[];
        creditScores: { cibil: number; experian: number };
      };
    } catch {
      return null;
    }
  };

  const writeLocalSnapshot = (
    userId: string,
    snapshot: {
      transactions: Transaction[];
      debts: Debt[];
      investments: Investment[];
      wishlist: WishlistItem[];
      creditScores: { cibil: number; experian: number };
    },
  ) => {
    try {
      localStorage.setItem(getSnapshotKey(userId), JSON.stringify(snapshot));
    } catch {
      // ignore localStorage quota/unavailable errors
    }
  };

  const replaceTempItem = <T extends { id: string }>(items: T[], tempId: string, replacement: T) =>
    items.map(item => (item.id === tempId ? replacement : item));

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Load the user's profile row. Returns the profile or null. */
  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data && !error) {
      const isRoleAdmin = data.role === 'admin' || data.is_admin === true;
      const profileStatus = resolveProfileStatus(data);

      setUserNameState(data.name || data.username || 'User');
      setUserEmail(data.email || '');
      setAuthUsername(data.username || '');
      setIsAdmin(isRoleAdmin);
      return { ...data, status: profileStatus, role: isRoleAdmin ? 'admin' : 'user' };
    }
    return null;
  };

  /** Load every data table for the currently-authenticated user. */
  const loadAllData = async (userId: string) => {
    if (!userId) return;

    try {
      let synced = false;

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const [txRes, debtRes, invRes, wishRes, csRes] = await Promise.all([
          supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }),
          supabase.from('debts').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('investments').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('wishlist').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
          supabase.from('credit_scores').select('*').eq('user_id', userId).maybeSingle(),
        ]);

        const hardError = txRes.error || debtRes.error || invRes.error || wishRes.error;

        if (!hardError) {
          setTransactions((txRes.data ?? []).map(dbToTransaction));
          setDebts((debtRes.data ?? []).map(dbToDebt));
          setInvestments((invRes.data ?? []).map(dbToInvestment));
          setWishlist((wishRes.data ?? []).map(dbToWishlistItem));
          setCreditScores({ cibil: csRes.data?.cibil || 0, experian: csRes.data?.experian || 0 });
          setIsCloudConnected(true);
          synced = true;
          break;
        }

        if (attempt < 3) await wait(250 * attempt);
      }

      if (!synced) throw new Error('Cloud sync failed');
    } catch {
      setIsCloudConnected(false);

      const local = readLocalSnapshot(userId);
      if (local) {
        setTransactions(local.transactions ?? []);
        setDebts(local.debts ?? []);
        setInvestments(local.investments ?? []);
        setWishlist(local.wishlist ?? []);
        setCreditScores(local.creditScores ?? { cibil: 0, experian: 0 });
      }
    }
  };

  /** Reset all state (used on sign-out). */
  const resetState = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUserNameState('User');
    setUserEmail('');
    setAuthUsername('');
    setCurrentUserId('');
    setTransactions([]);
    setDebts([]);
    setInvestments([]);
    setWishlist([]);
    setCreditScores({ cibil: 0, experian: 0 });
    setPendingUsers([]);
    try {
      localStorage.removeItem(LAST_ACTIVITY_AT_KEY);
    } catch {
      // ignore localStorage unavailable errors
    }
  };

  // ─── Auth state machine (single source of truth) ────────────────────────────
  useEffect(() => {
    let mounted = true;
    let syncRunning = false;           // dedup: only one syncAuthState at a time
    let initialFired = false;          // has onAuthStateChange fired at least once?

    // Hard deadline: unconditionally unblock UI after 6 s no matter what.
    // This fires even if onAuthStateChange already cancelled the soft timer.
    const hardDeadline = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] hard deadline reached – forcing isLoading=false');
        setIsLoading(false);
      }
    }, 6_000);

    // Soft safety net: if onAuthStateChange never fires at all, unblock after 3 s
    const safetyTimer = setTimeout(() => {
      if (mounted && !initialFired) setIsLoading(false);
    }, 3_000);

    const syncAuthState = async (session: any, source: string) => {
      if (!mounted) return;
      if (syncRunning) { console.warn('[Auth] syncAuthState(%s): already running → skip', source); setIsLoading(false); return; }
      syncRunning = true;

      try {
        if (!session?.user) {
          if (!loginInProgressRef.current) {
            console.warn('[Auth] syncAuthState(%s): no session → reset', source);
            resetState();
          }
          setIsLoading(false);
          return;
        }

        // While login() is running, let it manage its own state.
        if (loginInProgressRef.current) {
          console.warn('[Auth] syncAuthState(%s): login in progress → skip', source);
          setIsLoading(false);
          return;
        }

        const profile = await loadProfile(session.user.id);

        if (!mounted) return;

        if (!profile) {
          // If already authenticated as this user, treat as transient network glitch
          // (e.g. tab was backgrounded) — don't nuke the session.
          if (isAuthenticatedRef.current && currentUserIdRef.current === session.user.id) {
            console.warn('[Auth] syncAuthState(%s): profile load failed but already authenticated → keeping session', source);
            setIsLoading(false);
            return;
          }
          // Profile missing — maybe DB trigger hasn't fired yet. Wait briefly & retry once.
          await new Promise(r => setTimeout(r, 1500));
          if (!mounted) return;
          const retryProfile = await loadProfile(session.user.id);
          if (!mounted) return;
          if (!retryProfile || resolveProfileStatus(retryProfile) !== 'approved') {
            console.warn('[Auth] syncAuthState(%s): profile missing/unapproved after retry → signOut', source);
            await supabase.auth.signOut();
            resetState();
            setIsLoading(false);
            return;
          }
          setCurrentUserId(session.user.id);
          setIsAuthenticated(true);
          setIsLoading(false);
          await loadAllData(session.user.id);
          return;
        }

        if (resolveProfileStatus(profile) !== 'approved') {
          console.warn('[Auth] syncAuthState(%s): status ≠ approved → signOut', source);
          await supabase.auth.signOut();
          resetState();
          setIsLoading(false);
          return;
        }

        setCurrentUserId(session.user.id);
        setIsAuthenticated(true);
        setIsLoading(false);
        await loadAllData(session.user.id);
      } catch (err) {
        console.error('[Auth] syncAuthState(%s) error:', source, err);
        if (mounted) setIsLoading(false);
      } finally {
        syncRunning = false;
      }
    };

    // Use ONLY onAuthStateChange — it fires INITIAL_SESSION on mount.
    // We do NOT also call getSession() to avoid double-fire.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        initialFired = true;
        clearTimeout(safetyTimer);        // soft timer no longer needed

        try {
          // Events that should NOT trigger a full profile re-check
          if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            setIsLoading(false);
            return;
          }

          // While login() is running, skip auth-state events to avoid race
          if (loginInProgressRef.current && event !== 'SIGNED_OUT') {
            setIsLoading(false);
            return;
          }

          // Already authenticated as the same user — skip redundant re-sync
          // (Supabase can fire SIGNED_IN on token refresh or tab visibility)
          if (
            event === 'SIGNED_IN' &&
            isAuthenticatedRef.current &&
            session?.user?.id &&
            currentUserIdRef.current === session.user.id
          ) {
            setIsLoading(false);
            return;
          }

          await syncAuthState(session, `onAuthStateChange:${event}`);
        } catch (err) {
          console.error('[Auth] state change error:', err);
          if (mounted) setIsLoading(false);
        }
      },
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      clearTimeout(hardDeadline);
      subscription.unsubscribe();
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentUserId) return;
    writeLocalSnapshot(currentUserId, {
      transactions,
      debts,
      investments,
      wishlist,
      creditScores,
    });
  }, [currentUserId, transactions, debts, investments, wishlist, creditScores]);

  // Keep refs in sync with state so stale closures (auth state machine) read fresh values
  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return;

    const now = Date.now();
    lastActivityAtRef.current = now;
    try {
      localStorage.setItem(LAST_ACTIVITY_AT_KEY, String(now));
    } catch {
      // ignore localStorage unavailable errors
    }

    const recordActivity = () => {
      const activityNow = Date.now();
      lastActivityAtRef.current = activityNow;
      try {
        localStorage.setItem(LAST_ACTIVITY_AT_KEY, String(activityNow));
      } catch {
        // ignore localStorage unavailable errors
      }
    };

    const validateSessionWindow = async () => {
      if (logoutInProgressRef.current) return;

      const currentNow = Date.now();
      let lastActivityAt = lastActivityAtRef.current;

      if (!lastActivityAt || Number.isNaN(lastActivityAt)) {
        try {
          const stored = Number(localStorage.getItem(LAST_ACTIVITY_AT_KEY));
          if (stored && !Number.isNaN(stored)) {
            lastActivityAt = stored;
            lastActivityAtRef.current = stored;
          } else {
            lastActivityAt = currentNow;
            lastActivityAtRef.current = currentNow;
          }
        } catch {
          lastActivityAt = currentNow;
          lastActivityAtRef.current = currentNow;
        }
      }

      const inactiveExpired = currentNow - lastActivityAt >= INACTIVITY_TIMEOUT_MS;
      if (!inactiveExpired) return;

      logoutInProgressRef.current = true;
      try {
        await supabase.auth.signOut();
      } finally {
        resetState();
        logoutInProgressRef.current = false;
      }
    };

    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart', 'focus'];
    events.forEach(eventName => window.addEventListener(eventName, recordActivity, { passive: true }));

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') recordActivity();
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    const timer = window.setInterval(() => {
      void validateSessionWindow();
    }, 15_000);

    return () => {
      window.clearInterval(timer);
      events.forEach(eventName => window.removeEventListener(eventName, recordActivity));
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [isAuthenticated, currentUserId]);

  // ─── Login Step 1: verify password + profile → sign out → send email OTP ────
  const login = async (identifier: string, password: string): Promise<AuthResult> => {
    loginInProgressRef.current = true;
    try {
      // 1. Resolve username → email via SECURITY DEFINER RPC
      let email = identifier.trim().toLowerCase();
      if (!identifier.includes('@')) {
        const { data, error } = await supabase.rpc('get_login_email', { login_identifier: identifier.trim() });
        if (error || !data) {
          loginInProgressRef.current = false;
          return { success: false, message: 'No account found with that username or email.' };
        }
        email = data as string;
      }

      // 2. Authenticate with password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        loginInProgressRef.current = false;
        return { success: false, message: authError.message === 'Invalid login credentials'
          ? 'Incorrect email/username or password.'
          : authError.message };
      }

      if (!authData.user) {
        loginInProgressRef.current = false;
        return { success: false, message: 'Login failed.' };
      }

      // 3. Check profile status gate
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('status, approval_status, is_admin, role')
        .eq('id', authData.user.id)
        .single();

      if (profileErr || !profile) {
        await supabase.auth.signOut();
        loginInProgressRef.current = false;
        return { success: false, message: 'Profile not found. Please contact admin.' };
      }

      const profileStatus = resolveProfileStatus(profile);

      if (profileStatus === 'pending') {
        await supabase.auth.signOut();
        loginInProgressRef.current = false;
        return { success: false, message: 'Your account is waiting for admin approval.' };
      }
      if (profileStatus === 'rejected') {
        await supabase.auth.signOut();
        loginInProgressRef.current = false;
        return { success: false, message: 'Your registration was rejected.' };
      }

      // 4. Password verified + profile approved → sign out and send email OTP
      await supabase.auth.signOut();

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      if (otpError) {
        loginInProgressRef.current = false;
        return { success: false, message: 'Failed to send verification code: ' + otpError.message };
      }

      loginInProgressRef.current = false;
      return { success: true, requiresOTP: true, pendingEmail: email };
    } catch (e: any) {
      loginInProgressRef.current = false;
      return { success: false, message: e.message || 'Connection failed.' };
    }
  };

  // ─── Login Step 2: verify email OTP → if approved, hydrate session ──────────
  const verifyLoginOTP = async (email: string, otp: string): Promise<AuthResult> => {
    loginInProgressRef.current = true;
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) {
        loginInProgressRef.current = false;
        const msg = error.message.toLowerCase();
        if (msg.includes('expired') || msg.includes('invalid') || msg.includes('token')) {
          return { success: false, message: 'Invalid or expired code. Please request a new one.' };
        }
        return { success: false, message: error.message };
      }
      if (!data.user) {
        loginInProgressRef.current = false;
        return { success: false, message: 'Verification failed.' };
      }

      // Check profile status
      const profile = await loadProfile(data.user.id);
      const profileStatus = profile ? resolveProfileStatus(profile) : 'pending';

      if (profileStatus === 'approved') {
        // Fully authenticated — hydrate state
        setCurrentUserId(data.user.id);
        setIsAuthenticated(true);
        setIsLoading(false);
        loginInProgressRef.current = false;
        loadAllData(data.user.id);
        return { success: true };
      }

      // Not approved — clean up session
      await supabase.auth.signOut();
      loginInProgressRef.current = false;

      if (profileStatus === 'rejected') {
        return { success: false, message: 'Your registration was rejected by the admin.' };
      }

      // Pending — email verified but still waiting
      return { success: true, message: 'Email verified! Your account is pending admin approval.' };
    } catch (e: any) {
      loginInProgressRef.current = false;
      return { success: false, message: e.message || 'Verification failed.' };
    }
  };

  // ─── Register ───────────────────────────────────────────────────────────────
  const register = async (username: string, password: string, name: string, email: string): Promise<AuthResult> => {
    // Prevent syncAuthState from racing with us (signUp may auto-sign-in)
    loginInProgressRef.current = true;
    try {
      // 1. Pre-check username via RPC (SECURITY DEFINER, case-insensitive).
      //    If the function isn't deployed yet, skip the pre-check and let the
      //    DB UNIQUE constraint catch duplicates during signUp.
      const { data: usernameAvailable, error: checkErr } = await supabase
        .rpc('check_username_available', { p_username: username.trim() });
      if (checkErr) {
        // RPC not deployed or network error – log but don't block the user.
        console.warn('[register] check_username_available RPC unavailable:', checkErr.message);
      } else if (usernameAvailable === false) {
        loginInProgressRef.current = false;
        return { success: false, message: 'Username is already taken. Please choose a different one.' };
      }

      // 2. Also check email isn't already registered
      const { data: existingByEmail } = await supabase
        .rpc('get_login_email', { login_identifier: email.trim().toLowerCase() });
      if (existingByEmail) {
        loginInProgressRef.current = false;
        return { success: false, message: 'This email is already registered. Please log in instead.' };
      }

      // 3. Create auth user
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { name: name.trim(), username: username.trim().toLowerCase() } },
      });

      if (error) {
        loginInProgressRef.current = false;
        const msg = error.message.toLowerCase();
        if (msg.includes('already registered') || msg.includes('already been registered')) {
          return { success: false, message: 'This email is already registered.' };
        }
        if (msg.includes('username') || msg.includes('unique') || msg.includes('duplicate')) {
          return { success: false, message: 'Username is already taken. Please choose a different one.' };
        }
        return { success: false, message: error.message };
      }

      if (data.user) {
        // Supabase quirk: duplicate email returns user with empty identities array
        if (data.user.identities?.length === 0) {
          loginInProgressRef.current = false;
          return { success: false, message: 'This email is already registered.' };
        }
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: email.trim().toLowerCase(),
          username: username.trim().toLowerCase(),
          name: name.trim(),
          role: 'user',
          status: 'pending',
          approval_status: 'pending',
        }, { onConflict: 'id' });

        await supabase.auth.signOut();

        // Send email OTP for verification
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { shouldCreateUser: false },
        });

        if (otpError) {
          console.warn('[register] Failed to send verification OTP:', otpError.message);
          // Account was created but OTP send failed — they can retry login later
          loginInProgressRef.current = false;
          return { success: true, message: 'Registration successful! Please try logging in to receive your verification code.' };
        }

        loginInProgressRef.current = false;
        return {
          success: true,
          requiresOTP: true,
          pendingEmail: email.trim().toLowerCase(),
          message: 'Registration successful! Check your email for a verification code.',
        };
      }

      loginInProgressRef.current = false;
      return { success: false, message: 'Registration failed.' };
    } catch (e: any) {
      loginInProgressRef.current = false;
      return { success: false, message: e.message || 'Connection failed.' };
    }
  };

  // ─── Signup OTP verification ──────────────────────────────────────────────
  const verifyOTP = async (email: string, otp: string): Promise<AuthResult> => {
    loginInProgressRef.current = true;
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
      if (error) {
        loginInProgressRef.current = false;
        const msg = error.message.toLowerCase();
        if (msg.includes('expired') || msg.includes('invalid')) {
          return { success: false, message: 'Invalid or expired code. Please request a new one.' };
        }
        return { success: false, message: error.message };
      }

      if (data.user) {
        const profile = await loadProfile(data.user.id);
        if (resolveProfileStatus(profile) !== 'approved') {
          // Email verified but not yet approved by admin; sign out
          await supabase.auth.signOut();
          loginInProgressRef.current = false;
          return { success: true, message: 'Email verified! Your account is pending admin approval.' };
        }
        // Approved immediately (e.g., admin's own account) – hydrate state
        setCurrentUserId(data.user.id);
        setIsAuthenticated(true);
        setIsLoading(false);
        loginInProgressRef.current = false;
        loadAllData(data.user.id);
        return { success: true };
      }
      loginInProgressRef.current = false;
      return { success: true, message: 'Email verified! Please wait for admin approval.' };
    } catch (e: any) {
      loginInProgressRef.current = false;
      return { success: false, message: e.message || 'Verification failed.' };
    }
  };

  // ─── Resend OTP (works for both login 2FA and signup verification) ────────
  const resendOTP = async (email: string, flow: 'login' | 'signup'): Promise<AuthResult> => {
    try {
      if (flow === 'login') {
        // Re-send the email magic-link / OTP for login 2FA
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (error) return { success: false, message: error.message };
      } else {
        // Re-send signup confirmation OTP
        const { error } = await supabase.auth.resend({ type: 'signup', email });
        if (error) return { success: false, message: error.message };
      }
      return { success: true, message: 'New verification code sent!' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to resend.' };
    }
  };

  // ─── Forgot Password via OTP ──────────────────────────────────────────────
  const requestPasswordResetOTP = async (identifier: string): Promise<AuthResult> => {
    try {
      let email = identifier.trim().toLowerCase();
      if (!identifier.includes('@')) {
        const { data, error } = await supabase.rpc('get_login_email', { login_identifier: identifier.trim() });
        if (error || !data) return { success: false, message: 'No account found with that username or email.' };
        email = data as string;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      if (error) return { success: false, message: error.message };
      return { success: true, requiresOTP: true, pendingEmail: email, message: 'Password reset code sent to your email.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Failed to request password reset code.' };
    }
  };

  const verifyPasswordResetOTP = async (email: string, otp: string, newPassword: string): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('expired') || msg.includes('invalid')) {
          return { success: false, message: 'Invalid or expired code. Please request a new one.' };
        }
        return { success: false, message: error.message };
      }

      if (!data.user) return { success: false, message: 'Verification failed.' };

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      await supabase.auth.signOut();

      if (updateError) return { success: false, message: updateError.message };
      return { success: true, message: 'Password reset successful. Please sign in with your new password.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Password reset failed.' };
    }
  };

  // ─── Change Password ───────────────────────────────────────────────────────
  const changePassword = async (newPass: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      return !error;
    } catch { return false; }
  };

  // ─── Logout ─────────────────────────────────────────────────────────────────
  const logout = () => {
    supabase.auth.signOut();
    resetState();
  };

  // ─── Derived analytics ─────────────────────────────────────────────────────
  const totalAssets =
    investments.reduce((acc, curr) => acc + curr.currentValue, 0) +
    transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0) -
    transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const totalDebt = debts.reduce((acc, d) => acc + d.remainingAmount, 0);
  const netWorth = totalAssets - totalDebt;
  const monthlyEMI = debts.reduce((acc, d) => (d.isPaused ? acc : acc + d.monthlyEMI), 0);

  // ─── Health Score ───────────────────────────────────────────────────────────
  useEffect(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0) || 1;
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    const savings = totalIncome - totalExpenses;
    const savingsRate = Math.max(0, (savings / totalIncome) * 100);
    const debtBurden = (monthlyEMI / (totalIncome / 12)) * 100;
    const monthlyExpenseAvg = totalExpenses / 12 || 1;
    const emergencyCoverage = totalAssets / monthlyExpenseAvg;

    let score = 50;
    score += savingsRate > 20 ? 20 : savingsRate;
    score -= debtBurden > 30 ? debtBurden - 30 : 0;
    score += emergencyCoverage > 6 ? 15 : emergencyCoverage * 2;
    score -= totalDebt > totalAssets ? 20 : 0;
    score = Math.min(100, Math.max(0, Math.round(score)));

    let status: FinancialHealth['status'] = 'Warning';
    let color = '#f59e0b';
    if (score >= 80) { status = 'Excellent'; color = '#10b981'; }
    else if (score >= 60) { status = 'Good'; color = '#3b82f6'; }
    else if (score < 40) { status = 'Critical'; color = '#ef4444'; }

    setHealthScore({ score, status, color, factors: { savingsRate, debtBurden, emergencyCoverage } });
  }, [transactions, debts, investments, totalAssets, monthlyEMI, totalDebt]);

  // ─── CRUD: Transactions ─────────────────────────────────────────────────────
  const addTransaction = async (t: Omit<Transaction, 'id'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const optimisticId = `local-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticTransaction: Transaction = { id: optimisticId, ...t };
    setTransactions(prev => [optimisticTransaction, ...prev]);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { data, error } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: t.amount,
        type: t.type,
        category: t.category,
        description: t.description,
        date: t.date,
      }).select().single();

      if (data && !error) {
        setTransactions(prev => replaceTempItem(prev, optimisticId, dbToTransaction(data)));
        setIsCloudConnected(true);
        return;
      }

      if (attempt < 3) await wait(250 * attempt);
    }

    setIsCloudConnected(false);
    console.error('[Transactions] Failed to persist transaction after retries. Saved locally as backup.');
  };

  // ─── CRUD: Debts ────────────────────────────────────────────────────────────
  const addDebt = async (d: Omit<Debt, 'id' | 'remainingAmount'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const optimisticId = `local-debt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticDebt: Debt = {
      id: optimisticId,
      name: d.name,
      type: d.type,
      totalAmount: d.totalAmount,
      remainingAmount: d.totalAmount,
      interestRate: d.interestRate,
      monthlyEMI: d.monthlyEMI,
      dueDate: d.dueDate,
      isPaused: d.isPaused,
    };
    setDebts(prev => [...prev, optimisticDebt]);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { data, error } = await supabase.from('debts').insert({
        user_id: user.id,
        name: d.name,
        type: d.type,
        total_amount: d.totalAmount,
        remaining_amount: d.totalAmount,
        interest_rate: d.interestRate,
        monthly_emi: d.monthlyEMI,
        due_date: d.dueDate,
        is_paused: d.isPaused,
      }).select().single();

      if (data && !error) {
        setDebts(prev => replaceTempItem(prev, optimisticId, dbToDebt(data)));
        setIsCloudConnected(true);
        return;
      }

      if (attempt < 3) await wait(250 * attempt);
    }

    setIsCloudConnected(false);
    console.error('[Debts] Failed to persist debt after retries. Saved locally as backup.');
  };

  const updateDebt = async (id: string, updates: Partial<Debt>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.totalAmount !== undefined) dbUpdates.total_amount = updates.totalAmount;
    if (updates.remainingAmount !== undefined) dbUpdates.remaining_amount = updates.remainingAmount;
    if (updates.interestRate !== undefined) dbUpdates.interest_rate = updates.interestRate;
    if (updates.monthlyEMI !== undefined) dbUpdates.monthly_emi = updates.monthlyEMI;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.isPaused !== undefined) dbUpdates.is_paused = updates.isPaused;

    setDebts(prev => prev.map(d => (d.id === id ? { ...d, ...updates } : d)));

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { error } = await supabase.from('debts').update(dbUpdates).eq('id', id);
      if (!error) {
        setIsCloudConnected(true);
        return;
      }
      if (attempt < 3) await wait(250 * attempt);
    }

    setIsCloudConnected(false);
    console.error('[Debts] Failed to persist debt update after retries. Saved locally as backup.');
  };

  const deleteDebt = async (id: string) => {
    const { error } = await supabase.from('debts').delete().eq('id', id);
    if (!error) setDebts(prev => prev.filter(d => d.id !== id));
  };

  const payEMI = async (debtId: string, amount: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Run both operations concurrently:
    //   - Atomic SQL decrement via RPC (no read-modify-write race between tabs/users)
    //   - Insert expense transaction
    const today = new Date().toISOString().split('T')[0];
    const optimisticTxId = `local-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticTx: Transaction = {
      id: optimisticTxId,
      amount,
      type: 'expense',
      category: 'Debt Repayment',
      date: today,
      description: 'EMI Payment',
    };

    setDebts(prev => prev.map(d =>
      d.id === debtId ? { ...d, remainingAmount: Math.max(0, d.remainingAmount - amount) } : d
    ));
    setTransactions(prev => [optimisticTx, ...prev]);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const [emiResult, txResult] = await Promise.all([
        supabase.rpc('pay_debt_emi', { p_debt_id: debtId, p_amount: amount }),
        supabase.from('transactions').insert({
          user_id: user.id,
          amount,
          type: 'expense',
          category: 'Debt Repayment',
          date: today,
          description: 'EMI Payment',
        }).select().single(),
      ]);

      if (!emiResult.error && emiResult.data !== null) {
        setDebts(prev => prev.map(d =>
          d.id === debtId ? { ...d, remainingAmount: Number(emiResult.data) } : d
        ));
      }

      if (!txResult.error && txResult.data) {
        setTransactions(prev => replaceTempItem(prev, optimisticTxId, dbToTransaction(txResult.data)));
      }

      if (!emiResult.error && !txResult.error) {
        setIsCloudConnected(true);
        return;
      }

      if (attempt < 3) await wait(250 * attempt);
    }

    setIsCloudConnected(false);
    console.error('[Debts] Failed to persist EMI payment after retries. Saved locally as backup.');
  };

  // ─── CRUD: Investments ──────────────────────────────────────────────────────
  const addInvestment = async (i: Omit<Investment, 'id'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from('investments').insert({
      user_id: user.id,
      name: i.name,
      type: i.type,
      invested_amount: i.investedAmount,
      current_value: i.currentValue,
      last_updated: i.lastUpdated,
      goal_name: i.goalName || null,
      target_value: i.targetValue ?? 0,
      expected_annual_return: i.expectedAnnualReturn ?? 0,
      tenure_months: i.tenureMonths ?? 0,
      monthly_contribution: i.monthlyContribution ?? 0,
      interest_rate: i.interestRate ?? 0,
      risk_level: i.riskLevel || 'medium',
      notes: i.notes || null,
    }).select().single();

    if (data && !error) setInvestments(prev => [...prev, dbToInvestment(data)]);
  };

  // ─── CRUD: Wishlist ─────────────────────────────────────────────────────────
  const addToWishlist = async (w: Omit<WishlistItem, 'id' | 'status' | 'viewCount'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from('wishlist').insert({
      user_id: user.id,
      name: w.name,
      category: w.category,
      estimated_cost: w.estimatedCost,
      priority: w.priority,
      status: 'added',
      view_count: 0,
    }).select().single();

    if (data && !error) setWishlist(prev => [...prev, dbToWishlistItem(data)]);
  };

  const updateWishlistItem = async (id: string, updates: Partial<WishlistItem>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.estimatedCost !== undefined) dbUpdates.estimated_cost = updates.estimatedCost;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.viewCount !== undefined) dbUpdates.view_count = updates.viewCount;

    const { error } = await supabase.from('wishlist').update(dbUpdates).eq('id', id);
    if (!error) setWishlist(prev => prev.map(item => (item.id === id ? { ...item, ...updates } : item)));
  };

  const deleteWishlistItem = async (id: string) => {
    const { error } = await supabase.from('wishlist').delete().eq('id', id);
    if (!error) setWishlist(prev => prev.filter(item => item.id !== id));
  };

  // ─── Credit Scores ─────────────────────────────────────────────────────────
  const updateCreditScores = async (scores: { cibil: number; experian: number }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCreditScores(scores);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { error } = await supabase.from('credit_scores').upsert(
        { user_id: user.id, cibil: scores.cibil, experian: scores.experian, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );

      if (!error) {
        setIsCloudConnected(true);
        return;
      }

      if (attempt < 3) await wait(250 * attempt);
    }

    setIsCloudConnected(false);
    console.error('[CreditScores] Failed to persist scores after retries. Saved locally as backup.');
  };

  // ─── Set User Display Name (updates profile) ───────────────────────────────
  const setUserName = (name: string) => {
    setUserNameState(name);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.from('profiles').update({ name }).eq('id', user.id);
    });
  };

  // ─── Admin ──────────────────────────────────────────────────────────────────
  const verifyAdminIdentity = async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (!profile) return false;
    return profile.role === 'admin';
  };

  const fetchPendingUsers = useCallback(async () => {
    const ok = await verifyAdminIdentity();
    if (!ok) { console.warn('[Admin] identity check failed — skipping fetch'); return; }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, username, email, role, status, created_at')
      .eq('status', 'pending')
      .eq('role', 'user');
    if (error) { console.error('[Admin] fetchPendingUsers error:', error.message); return; }
    setPendingUsers(data ?? []);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const approveUser = async (profileId: string) => {
    const ok = await verifyAdminIdentity();
    if (!ok) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'approved', approval_status: 'approved' })
      .eq('id', profileId);
    if (error) { console.error('[Admin] approveUser error:', error.message); return false; }
    setPendingUsers(prev => prev.filter(u => u.id !== profileId));
    return true;
  };

  const rejectUser = async (profileId: string) => {
    const ok = await verifyAdminIdentity();
    if (!ok) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'rejected', approval_status: 'rejected' })
      .eq('id', profileId);
    if (error) { console.error('[Admin] rejectUser error:', error.message); return false; }
    setPendingUsers(prev => prev.filter(u => u.id !== profileId));
    return true;
  };

  // ─── Provider ───────────────────────────────────────────────────────────────
  return (
    <FinanceContext.Provider value={{
      transactions, debts, investments, wishlist, currency, userName, setUserName,
      addTransaction, addDebt, updateDebt, deleteDebt, payEMI, addInvestment,
      addToWishlist, updateWishlistItem, deleteWishlistItem,
      healthScore, netWorth, totalDebt, monthlyEMI, creditScores, updateCreditScores,
      isAuthenticated, isAdmin,
      login, verifyLoginOTP, register, verifyOTP, resendOTP,
      requestPasswordResetOTP, verifyPasswordResetOTP,
      changePassword, logout,
      isLoading, isCloudConnected,
      authUsername, userEmail,
      pendingUsers, fetchPendingUsers, approveUser, rejectUser,
    }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (context === undefined) throw new Error('useFinance must be used within a FinanceProvider');
  return context;
};