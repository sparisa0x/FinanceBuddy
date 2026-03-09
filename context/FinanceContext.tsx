import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useUser, useAuth } from '@clerk/react';
import { Transaction, Debt, Investment, WishlistItem, FinancialHealth } from '../types';
import { createClerkSupabaseClient } from '../lib/supabase';

// ─── Context Interface ───────────────────────────────────────────────────────

interface FinanceContextType {
  transactions: Transaction[];
  debts: Debt[];
  investments: Investment[];
  wishlist: WishlistItem[];
  currency: string;
  userName: string;
  setUserName: (name: string) => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  addDebt: (d: Omit<Debt, 'id' | 'remainingAmount'>) => void;
  updateDebt: (id: string, d: Partial<Debt>) => void;
  deleteDebt: (id: string) => void;
  payEMI: (debtId: string, amount: number) => void;
  addInvestment: (i: Omit<Investment, 'id'>) => void;
  deleteInvestment: (id: string) => void;
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
  isLoading: boolean;
  isCloudConnected: boolean;
  profileStatus: 'pending' | 'approved' | 'rejected' | null;
  authUsername: string;
  userEmail: string;
  /** True while profile is being fetched from Supabase after Clerk sign-in */
  isProfileLoading: boolean;
  /** Create / update a Supabase profile row for the current Clerk user. */
  ensureProfile: (name: string, username: string, email: string) => Promise<boolean>;
  // Admin
  pendingUsers: any[];
  fetchPendingUsers: () => Promise<void>;
  approveUser: (profileId: string) => Promise<boolean>;
  rejectUser: (profileId: string) => Promise<boolean>;
}

// ─── DB → Frontend mappers (snake_case → camelCase) ──────────────────────────

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

// ─── Context ─────────────────────────────────────────────────────────────────

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ── Clerk hooks ────────────────────────────────────────────────────────────
  const { user, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();

  // ── Authenticated Supabase client (uses Clerk-issued JWT) ──────────────────
  const supabase = useMemo(
    () => createClerkSupabaseClient(getToken),
    [getToken],
  );

  // ── State ──────────────────────────────────────────────────────────────────
  const [profileStatus, setProfileStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(true);

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

  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Derived auth state — user is "authenticated" only when Clerk session is
  // active AND their Supabase profile has been approved by an admin.
  const isAuthenticated = Boolean(clerkLoaded && isSignedIn && profileStatus === 'approved');
  const isLoading = !clerkLoaded;

  // ── Local snapshot helpers (offline fallback) ──────────────────────────────
  const LOCAL_SNAPSHOT_PREFIX = 'financebuddy_snapshot_v1_';
  const getSnapshotKey = (uid: string) => `${LOCAL_SNAPSHOT_PREFIX}${uid}`;
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const readLocalSnapshot = (uid: string) => {
    try {
      const raw = localStorage.getItem(getSnapshotKey(uid));
      if (!raw) return null;
      return JSON.parse(raw) as {
        transactions: Transaction[];
        debts: Debt[];
        investments: Investment[];
        wishlist: WishlistItem[];
        creditScores: { cibil: number; experian: number };
      };
    } catch { return null; }
  };

  const writeLocalSnapshot = (
    uid: string,
    snapshot: {
      transactions: Transaction[];
      debts: Debt[];
      investments: Investment[];
      wishlist: WishlistItem[];
      creditScores: { cibil: number; experian: number };
    },
  ) => {
    try { localStorage.setItem(getSnapshotKey(uid), JSON.stringify(snapshot)); }
    catch { /* ignore quota errors */ }
  };

  const replaceTempItem = <T extends { id: string }>(items: T[], tempId: string, replacement: T) =>
    items.map(item => (item.id === tempId ? replacement : item));

  // ── Profile loading ────────────────────────────────────────────────────────

  const loadProfile = useCallback(async (userId: string) => {
    // Uses a SECURITY DEFINER RPC so it works even without a valid JWT.
    const { data, error } = await supabase
      .rpc('get_profile_by_clerk_id', { p_clerk_id: userId });

    if (error) {
      console.error('[Auth] get_profile_by_clerk_id error:', error.message);
      return null;
    }

    const profile = Array.isArray(data) ? data[0] : data;
    if (profile) {
      const status = (profile.status as 'pending' | 'approved' | 'rejected') ?? 'pending';
      const isRoleAdmin = profile.role === 'admin';
      setUserNameState(profile.name || profile.username || 'User');
      setUserEmail(profile.email || '');
      setAuthUsername(profile.username || '');
      setIsAdmin(isRoleAdmin);
      setProfileStatus(status);
      return profile;
    }
    return null;
  }, [supabase]);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadAllData = useCallback(async (userId: string) => {
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
  }, [supabase]);

  // ── Auth state: when Clerk user changes, load profile + data ───────────────

  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!clerkLoaded) return;

    if (!isSignedIn || !user) {
      // Signed out — reset all state
      setProfileStatus(null);
      setIsAdmin(false);
      setIsProfileLoading(false);
      setUserNameState('User');
      setUserEmail('');
      setAuthUsername('');
      setTransactions([]);
      setDebts([]);
      setInvestments([]);
      setWishlist([]);
      setCreditScores({ cibil: 0, experian: 0 });
      setPendingUsers([]);
      prevUserIdRef.current = null;
      return;
    }

    const userId = user.id;
    if (prevUserIdRef.current === userId) return; // already loaded for this user
    prevUserIdRef.current = userId;

    (async () => {
      setIsProfileLoading(true);
      try {
        let profile = await loadProfile(userId);

        // If no profile exists yet, create it via SECURITY DEFINER RPC.
        // The RPC auto-promotes admin email / first user — no JWT needed.
        if (!profile) {
          const clerkEmail = user.primaryEmailAddress?.emailAddress || '';
          const clerkName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'User';
          const clerkUsername = user.username || clerkEmail.split('@')[0] || 'user';

          const { error: rpcError } = await supabase.rpc('upsert_my_profile', {
            p_clerk_id: userId,
            p_email: clerkEmail,
            p_username: clerkUsername,
            p_name: clerkName,
          });

          if (rpcError) {
            console.error('[Auth] upsert_my_profile RPC error:', rpcError.message, rpcError);
          }

          // Re-load to pick up the newly created profile
          profile = await loadProfile(userId);
        }

        if (profile && profile.status === 'approved') {
          await loadAllData(userId);
        }
      } finally {
        setIsProfileLoading(false);
      }
    })();
  }, [clerkLoaded, isSignedIn, user, loadProfile, loadAllData, supabase]);

  // ── Persist local snapshot ─────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id || profileStatus !== 'approved') return;
    writeLocalSnapshot(user.id, { transactions, debts, investments, wishlist, creditScores });
  }, [user?.id, profileStatus, transactions, debts, investments, wishlist, creditScores]);

  // ── ensureProfile: create/update a Supabase profile after Clerk sign-up ────

  const ensureProfile = async (name: string, username: string, email: string): Promise<boolean> => {
    if (!user) return false;
    const userId = user.id;

    const { error } = await supabase.rpc('upsert_my_profile', {
      p_clerk_id: userId,
      p_email: email,
      p_username: username,
      p_name: name,
    });

    if (error) {
      console.error('[ensureProfile] error:', error.message);
      return false;
    }

    // Re-read profile status in case the email auto-promoted to admin
    await loadProfile(userId);
    return true;
  };

  // ─── CRUD: Transactions ─────────────────────────────────────────────────────

  const addTransaction = async (t: Omit<Transaction, 'id'>) => {
    if (!user) return;
    const userId = user.id;

    const optimisticId = `local-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticTransaction: Transaction = { id: optimisticId, ...t };
    setTransactions(prev => [optimisticTransaction, ...prev]);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { data, error } = await supabase.from('transactions').insert({
        user_id: userId,
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
    console.error('[Transactions] Failed to persist transaction after retries.');
  };

  const deleteTransaction = async (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    if (id.startsWith('local-')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) console.error('[Transactions] delete error:', error.message);
  };

  // ─── CRUD: Debts ────────────────────────────────────────────────────────────

  const addDebt = async (d: Omit<Debt, 'id' | 'remainingAmount'>) => {
    if (!user) return;
    const userId = user.id;

    const optimisticId = `local-debt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticDebt: Debt = {
      id: optimisticId,
      name: d.name, type: d.type,
      totalAmount: d.totalAmount, remainingAmount: d.totalAmount,
      interestRate: d.interestRate, monthlyEMI: d.monthlyEMI,
      dueDate: d.dueDate, isPaused: d.isPaused,
    };
    setDebts(prev => [...prev, optimisticDebt]);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { data, error } = await supabase.from('debts').insert({
        user_id: userId,
        name: d.name, type: d.type,
        total_amount: d.totalAmount, remaining_amount: d.totalAmount,
        interest_rate: d.interestRate, monthly_emi: d.monthlyEMI,
        due_date: d.dueDate, is_paused: d.isPaused,
      }).select().single();

      if (data && !error) {
        setDebts(prev => replaceTempItem(prev, optimisticId, dbToDebt(data)));
        setIsCloudConnected(true);
        return;
      }

      if (attempt < 3) await wait(250 * attempt);
    }

    setIsCloudConnected(false);
    console.error('[Debts] Failed to persist debt after retries.');
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
    console.error('[Debts] Failed to persist debt update after retries.');
  };

  const deleteDebt = async (id: string) => {
    const { error } = await supabase.from('debts').delete().eq('id', id);
    if (!error) setDebts(prev => prev.filter(d => d.id !== id));
  };

  const payEMI = async (debtId: string, amount: number) => {
    if (!user) return;
    const userId = user.id;

    const today = new Date().toISOString().split('T')[0];
    const optimisticTxId = `local-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticTx: Transaction = {
      id: optimisticTxId, amount, type: 'expense',
      category: 'Debt Repayment', date: today, description: 'EMI Payment',
    };

    setDebts(prev => prev.map(d =>
      d.id === debtId ? { ...d, remainingAmount: Math.max(0, d.remainingAmount - amount) } : d
    ));
    setTransactions(prev => [optimisticTx, ...prev]);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const [emiResult, txResult] = await Promise.all([
        supabase.rpc('pay_debt_emi', { p_debt_id: debtId, p_amount: amount }),
        supabase.from('transactions').insert({
          user_id: userId, amount, type: 'expense',
          category: 'Debt Repayment', date: today, description: 'EMI Payment',
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
    console.error('[Debts] Failed to persist EMI payment after retries.');
  };

  // ─── CRUD: Investments ──────────────────────────────────────────────────────

  const addInvestment = async (i: Omit<Investment, 'id'>) => {
    if (!user) return;

    const { data, error } = await supabase.from('investments').insert({
      user_id: user.id,
      name: i.name, type: i.type,
      invested_amount: i.investedAmount, current_value: i.currentValue,
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

  const deleteInvestment = async (id: string) => {
    setInvestments(prev => prev.filter(i => i.id !== id));
    const { error } = await supabase.from('investments').delete().eq('id', id);
    if (error) console.error('[Investments] delete error:', error.message);
  };

  // ─── CRUD: Wishlist ─────────────────────────────────────────────────────────

  const addToWishlist = async (w: Omit<WishlistItem, 'id' | 'status' | 'viewCount'>) => {
    if (!user) return;

    const { data, error } = await supabase.from('wishlist').insert({
      user_id: user.id,
      name: w.name, category: w.category,
      estimated_cost: w.estimatedCost, priority: w.priority,
      status: 'added', view_count: 0,
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
    console.error('[CreditScores] Failed to persist scores after retries.');
  };

  // ─── Set User Display Name ─────────────────────────────────────────────────

  const setUserName = (name: string) => {
    setUserNameState(name);
    if (user) {
      supabase.from('profiles').update({ name }).eq('id', user.id);
    }
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

  // ─── Admin ──────────────────────────────────────────────────────────────────

  const fetchPendingUsers = useCallback(async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, username, email, role, status, created_at')
      .eq('status', 'pending')
      .eq('role', 'user');
    if (error) { console.error('[Admin] fetchPendingUsers error:', error.message); return; }
    setPendingUsers(data ?? []);
  }, [isAdmin, supabase]);

  const approveUser = async (profileId: string) => {
    if (!isAdmin) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'approved' })
      .eq('id', profileId);
    if (error) { console.error('[Admin] approveUser error:', error.message); return false; }
    setPendingUsers(prev => prev.filter(u => u.id !== profileId));
    return true;
  };

  const rejectUser = async (profileId: string) => {
    if (!isAdmin) return false;
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'rejected' })
      .eq('id', profileId);
    if (error) { console.error('[Admin] rejectUser error:', error.message); return false; }
    setPendingUsers(prev => prev.filter(u => u.id !== profileId));
    return true;
  };

  // ─── Provider ───────────────────────────────────────────────────────────────

  return (
    <FinanceContext.Provider value={{
      transactions, debts, investments, wishlist, currency, userName, setUserName,
      addTransaction, deleteTransaction, addDebt, updateDebt, deleteDebt, payEMI,
      addInvestment, deleteInvestment, addToWishlist, updateWishlistItem, deleteWishlistItem,
      healthScore, netWorth, totalDebt, monthlyEMI, creditScores, updateCreditScores,
      isAuthenticated, isAdmin,
      isLoading, isProfileLoading, isCloudConnected,
      profileStatus, authUsername, userEmail,
      ensureProfile,
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
