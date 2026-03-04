import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  changePassword: (newPass: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isCloudConnected: boolean;
  authUsername: string;
  userEmail: string;

  // Admin
  pendingUsers: any[];
  fetchPendingUsers: () => Promise<void>;
  approveUser: (username: string) => Promise<boolean>;
  rejectUser: (username: string) => Promise<boolean>;
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

// ─── Context ─────────────────────────────────────────────────────────────────
const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState(true);

  // Set to true during the login 2FA flow (password-check → signOut → sendOTP)
  // to prevent onAuthStateChange from treating intermediate events as real sign-ins.
  const loginFlowActiveRef = useRef(false);

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
  const currency = '₹';

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Load the user's profile row. Returns the profile or null. */
  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data && !error) {
      setUserNameState(data.name || 'User');
      setUserEmail(data.email || '');
      setAuthUsername(data.username || '');
      setIsAdmin(data.is_admin || false);
      return data;
    }
    return null;
  };

  /** Load every data table for the currently-authenticated user. */
  const loadAllData = async () => {
    try {
      const [txRes, debtRes, invRes, wishRes, csRes] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('debts').select('*').order('created_at', { ascending: false }),
        supabase.from('investments').select('*').order('created_at', { ascending: false }),
        supabase.from('wishlist').select('*').order('created_at', { ascending: false }),
        supabase.from('credit_scores').select('*').limit(1).single(),
      ]);

      if (txRes.data) setTransactions(txRes.data.map(dbToTransaction));
      if (debtRes.data) setDebts(debtRes.data.map(dbToDebt));
      if (invRes.data) setInvestments(invRes.data.map(dbToInvestment));
      if (wishRes.data) setWishlist(wishRes.data.map(dbToWishlistItem));
      if (csRes.data) setCreditScores({ cibil: csRes.data.cibil || 0, experian: csRes.data.experian || 0 });

      setIsCloudConnected(true);
    } catch {
      setIsCloudConnected(false);
    }
  };

  /** Reset all state (used on sign-out). */
  const resetState = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUserNameState('User');
    setUserEmail('');
    setAuthUsername('');
    setTransactions([]);
    setDebts([]);
    setInvestments([]);
    setWishlist([]);
    setCreditScores({ cibil: 0, experian: 0 });
    setPendingUsers([]);
  };

  // ─── Auth state machine (single source of truth) ────────────────────────────
  useEffect(() => {
    let mounted = true;

    // Safety net: if onAuthStateChange never fires (network error, etc.) unblock UI
    const safetyTimer = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 10_000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        clearTimeout(safetyTimer);

        // Suppress all intermediate events that occur during the login 2FA flow
        // (signInWithPassword → signOut → signInWithOtp). Real auth happens only
        // after verifyLoginOTP() succeeds and fires a fresh SIGNED_IN.
        if (loginFlowActiveRef.current) return;

        try {
          // ── No session (logged out, OTP pending, etc.) ──────────────────────
          if (!session?.user) {
            resetState();
            setIsLoading(false);
            return;
          }

          // ── Token silently refreshed – stay authenticated, nothing else needed
          if (event === 'TOKEN_REFRESHED') {
            setIsLoading(false);
            return;
          }

          // ── New sign-in or page refresh with existing session ───────────────
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            const profile = await loadProfile(session.user.id);

            if (!profile || profile.approval_status !== 'approved') {
              // Not approved – clear the session; SIGNED_OUT will follow
              await supabase.auth.signOut();
              return; // SIGNED_OUT path sets isLoading=false via resetState
            }

            setIsAuthenticated(true);
            setIsLoading(false); // Show UI immediately
            loadAllData();       // Populate data in background
          }
        } catch (err) {
          console.error('[Auth] state change error:', err);
          setIsLoading(false); // Always unblock the UI on error
        }
      },
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Login (Step 1: verify password + approval, then dispatch email OTP) ─────
  const login = async (identifier: string, password: string): Promise<AuthResult> => {
    try {
      // Resolve username → email via SECURITY DEFINER RPC
      let email = identifier.trim().toLowerCase();
      if (!identifier.includes('@')) {
        const { data, error } = await supabase.rpc('get_login_email', { login_identifier: identifier.trim() });
        if (error || !data) return { success: false, message: 'No account found with that username or email.' };
        email = data as string;
      }

      // Authenticate with password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        return { success: false, message: authError.message === 'Invalid login credentials'
          ? 'Incorrect email/username or password.'
          : authError.message };
      }

      if (!authData.user) return { success: false, message: 'Login failed.' };

      // Check admin-approval status
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('approval_status')
        .eq('id', authData.user.id)
        .single();

      if (profileErr || !profile) {
        await supabase.auth.signOut();
        return { success: false, message: 'Profile not found. Please contact admin.' };
      }
      if (profile.approval_status === 'pending') {
        await supabase.auth.signOut();
        return { success: false, message: 'Your account is pending admin approval.' };
      }
      if (profile.approval_status === 'rejected') {
        await supabase.auth.signOut();
        return { success: false, message: 'Your account has been rejected by admin.' };
      }

      // Approved ✓ — sign the password session OUT and send a one-time email OTP
      // for 2-factor verification. The real session is created after OTP verification.
      //
      // IMPORTANT: suppress onAuthStateChange during this sequence so the brief
      // SIGNED_IN (password) and SIGNED_OUT (our own signOut) don't flip the UI.
      loginFlowActiveRef.current = true;
      try {
        await supabase.auth.signOut();

        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });

        if (otpError) {
          loginFlowActiveRef.current = false;
          return { success: false, message: 'Failed to send verification code. Please try again.' };
        }
      } finally {
        // Always clear the flag; verifyLoginOTP triggers a fresh SIGNED_IN
        loginFlowActiveRef.current = false;
      }

      return { success: true, requiresOTP: true, pendingEmail: email };
    } catch (e: any) {
      loginFlowActiveRef.current = false;
      return { success: false, message: e.message || 'Connection failed.' };
    }
  };

  // ─── Login (Step 2: verify the email OTP → creates real session) ─────────────
  const verifyLoginOTP = async (email: string, otp: string): Promise<AuthResult> => {
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
      // onAuthStateChange(SIGNED_IN) fires → sets isAuthenticated=true+loads data
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e.message || 'Verification failed.' };
    }
  };

  // ─── Register ───────────────────────────────────────────────────────────────
  const register = async (username: string, password: string, name: string, email: string): Promise<AuthResult> => {
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
        return { success: false, message: 'Username is already taken. Please choose a different one.' };
      }

      // 2. Also check email isn't already registered
      const { data: existingByEmail } = await supabase
        .rpc('get_login_email', { login_identifier: email.trim().toLowerCase() });
      if (existingByEmail) {
        return { success: false, message: 'This email is already registered. Please log in instead.' };
      }

      // 3. Create auth user – trigger handle_new_user() creates profile + credit_scores
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { name: name.trim(), username: username.trim().toLowerCase() } },
      });

      if (error) {
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
          return { success: false, message: 'This email is already registered.' };
        }
        // No session → email confirmation required (OTP flow)
        if (!data.session) {
          return {
            success: true,
            message: 'Verification code sent to your email!',
            requiresOTP: true,
            pendingEmail: email.trim().toLowerCase(),
          };
        }
        // Session exists → auto-confirmed (Supabase email confirmation disabled)
        // onAuthStateChange(SIGNED_IN) sets isAuthenticated + loads data
        return { success: true };
      }

      return { success: false, message: 'Registration failed.' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Connection failed.' };
    }
  };

  // ─── Signup OTP verification ──────────────────────────────────────────────
  const verifyOTP = async (email: string, otp: string): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('expired') || msg.includes('invalid')) {
          return { success: false, message: 'Invalid or expired code. Please request a new one.' };
        }
        return { success: false, message: error.message };
      }

      if (data.user) {
        const profile = await loadProfile(data.user.id);
        if (profile?.approval_status !== 'approved') {
          // Email verified but not yet approved by admin; sign out
          await supabase.auth.signOut();
          return { success: true, message: 'Email verified! Your account is pending admin approval.' };
        }
        // Approved immediately (e.g., admin's own account) – auth state fires
        return { success: true };
      }
      return { success: true, message: 'Email verified! Please wait for admin approval.' };
    } catch (e: any) {
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

    const { data, error } = await supabase.from('transactions').insert({
      user_id: user.id,
      amount: t.amount,
      type: t.type,
      category: t.category,
      description: t.description,
      date: t.date,
    }).select().single();

    if (data && !error) setTransactions(prev => [dbToTransaction(data), ...prev]);
  };

  // ─── CRUD: Debts ────────────────────────────────────────────────────────────
  const addDebt = async (d: Omit<Debt, 'id' | 'remainingAmount'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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

    if (data && !error) setDebts(prev => [...prev, dbToDebt(data)]);
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

    const { error } = await supabase.from('debts').update(dbUpdates).eq('id', id);
    if (!error) setDebts(prev => prev.map(d => (d.id === id ? { ...d, ...updates } : d)));
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

    // Update local state with authoritative DB value
    if (!emiResult.error && emiResult.data !== null) {
      setDebts(prev => prev.map(d =>
        d.id === debtId ? { ...d, remainingAmount: Number(emiResult.data) } : d
      ));
    }
    if (txResult.data && !txResult.error) {
      setTransactions(prev => [dbToTransaction(txResult.data), ...prev]);
    }
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

    const { error } = await supabase.from('credit_scores').upsert(
      { user_id: user.id, cibil: scores.cibil, experian: scores.experian, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (!error) setCreditScores(scores);
  };

  // ─── Set User Display Name (updates profile) ───────────────────────────────
  const setUserName = (name: string) => {
    setUserNameState(name);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.from('profiles').update({ name }).eq('id', user.id);
    });
  };

  // ─── Admin ──────────────────────────────────────────────────────────────────
  const fetchPendingUsers = async () => {
    if (!isAdmin) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, name, username, email, created_at, approval_status')
      .eq('approval_status', 'pending');
    if (data) setPendingUsers(data);
  };

  const approveUser = async (usernameTarget: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: 'approved' })
      .eq('username', usernameTarget);
    if (!error) { setPendingUsers(prev => prev.filter(u => u.username !== usernameTarget)); return true; }
    return false;
  };

  const rejectUser = async (usernameTarget: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: 'rejected' })
      .eq('username', usernameTarget);
    if (!error) { setPendingUsers(prev => prev.filter(u => u.username !== usernameTarget)); return true; }
    return false;
  };

  // ─── Provider ───────────────────────────────────────────────────────────────
  return (
    <FinanceContext.Provider value={{
      transactions, debts, investments, wishlist, currency, userName, setUserName,
      addTransaction, addDebt, updateDebt, deleteDebt, payEMI, addInvestment,
      addToWishlist, updateWishlistItem, deleteWishlistItem,
      healthScore, netWorth, totalDebt, monthlyEMI, creditScores, updateCreditScores,
      isAuthenticated, isAdmin,
      login, verifyLoginOTP, register, verifyOTP, resendOTP, changePassword, logout,
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