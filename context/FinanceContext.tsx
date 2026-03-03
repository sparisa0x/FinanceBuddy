import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { calculateEMI, calculateHealthScore } from '../lib/finance';

// ── Shared types (used by components too) ──────────────────────────────────

export interface DashboardProfile {
  name: string;
  monthly_income: number;
  monthly_savings_target: number;
}

export interface DashboardSummary {
  net_worth: number;
  total_income_month: number;
  total_expense_month: number;
  total_debt: number;
  total_invested: number;
  health_score: number;
  emi_burden_pct: number;
  emergency_fund_months: number;
}

export interface RecentTransaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string | null;
  date: string;
}

export interface DebtWithEMI {
  id: string;
  name: string;
  principal: number;
  outstanding_principal: number;
  annual_rate: number;
  tenure_months: number;
  start_date: string;
  lender: string | null;
  monthly_emi: number;
}

export interface CreditScores {
  cibil: number | null;
  experian: number | null;
}

export interface NetWorthSnapshot {
  snapshot_date: string;
  net_worth: number;
}

export interface WishlistItem {
  id: string;
  name: string;
  estimated_cost: number;
  priority: 'low' | 'medium' | 'high';
  target_date: string | null;
  is_purchased: boolean;
}

export interface DashboardData {
  profile: DashboardProfile;
  summary: DashboardSummary;
  recent_transactions: RecentTransaction[];
  debts_with_emi: DebtWithEMI[];
  credit_scores: CreditScores;
  net_worth_history: NetWorthSnapshot[];
  wishlist_highlights: WishlistItem[];
}

// ── Context ────────────────────────────────────────────────────────────────

interface FinanceContextType {
  dashboardData: DashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error,   setError]               = useState<string | null>(null);
  const lastFetchedAt                     = useRef<number>(0);

  const fetchDashboard = useCallback(async (force = false) => {
    if (!user) return;
    const now = Date.now();
    if (!force && dashboardData && now - lastFetchedAt.current < CACHE_TTL_MS) return;

    setLoading(true);
    setError(null);
    try {
      const uid = user.id;
      const today = new Date();
      const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

      const [txAllRes, txMonthRes, debtsRes, investRes, creditRes, nwRes, wishRes] =
        await Promise.all([
          supabase.from('transactions').select('amount,type').eq('user_id', uid),
          supabase.from('transactions')
            .select('id,amount,type,category,description,date')
            .eq('user_id', uid)
            .gte('date', firstOfMonth)
            .order('date', { ascending: false }),
          supabase.from('debts').select('*').eq('user_id', uid),
          supabase.from('investments').select('invested_amount,current_value').eq('user_id', uid),
          supabase.from('credit_scores').select('cibil,experian').eq('user_id', uid).maybeSingle(),
          supabase.from('net_worth_snapshots')
            .select('snapshot_date,net_worth')
            .eq('user_id', uid)
            .order('snapshot_date', { ascending: true })
            .limit(12),
          supabase.from('wishlist')
            .select('*')
            .eq('user_id', uid)
            .eq('is_purchased', false)
            .in('priority', ['high'])
            .limit(3),
        ]);

      const allTx    = txAllRes.data   ?? [];
      const monthTx  = txMonthRes.data ?? [];
      const debts    = debtsRes.data   ?? [];
      const invs     = investRes.data  ?? [];

      const totalIncome  = allTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const totalExpense = allTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
      const monthIncome  = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
      const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

      const totalDebt     = debts.reduce((s, d) => s + Number(d.outstanding_principal), 0);
      const totalInvested = invs.reduce((s, i) => s + Number(i.current_value), 0);

      const debtsWithEMI = debts.map(d => ({
        ...d,
        monthly_emi: calculateEMI(Number(d.outstanding_principal), Number(d.annual_rate), Number(d.tenure_months)),
      }));
      const totalMonthlyEMI = debtsWithEMI.reduce((s, d) => s + d.monthly_emi, 0);

      const netWorth = (totalIncome - totalExpense) + totalInvested - totalDebt;
      const monthlyIncome = profile?.monthly_income ? Number(profile.monthly_income) : monthIncome;

      const healthScore = calculateHealthScore({
        monthly_income:    monthlyIncome,
        total_monthly_emi: totalMonthlyEMI,
        monthly_expense:   monthExpense,
        total_savings:     Math.max(0, totalIncome - totalExpense),
        total_invested:    totalInvested,
      });

      const emiBurdenPct       = monthlyIncome > 0 ? Math.round((totalMonthlyEMI / monthlyIncome) * 100) : 0;
      const emergencyFundMonths = monthExpense > 0 ? Math.max(0, Math.floor((totalIncome - totalExpense) / monthExpense)) : 0;

      // Persist today's net-worth snapshot (fire-and-forget)
      const todayStr = today.toISOString().split('T')[0];
      supabase.from('net_worth_snapshots')
        .upsert({ user_id: uid, snapshot_date: todayStr, net_worth: netWorth }, { onConflict: 'user_id,snapshot_date' })
        .then(() => {/* intentional no-op */});

      setDashboardData({
        profile: {
          name: profile?.name ?? '',
          monthly_income: profile?.monthly_income ?? 0,
          monthly_savings_target: profile?.monthly_savings_target ?? 0,
        },
        summary: {
          net_worth:             netWorth,
          total_income_month:    monthIncome,
          total_expense_month:   monthExpense,
          total_debt:            totalDebt,
          total_invested:        totalInvested,
          health_score:          healthScore,
          emi_burden_pct:        emiBurdenPct,
          emergency_fund_months: emergencyFundMonths,
        },
        recent_transactions: monthTx.slice(0, 5) as RecentTransaction[],
        debts_with_emi:       debtsWithEMI,
        credit_scores: {
          cibil:    creditRes.data?.cibil    ?? null,
          experian: creditRes.data?.experian ?? null,
        },
        net_worth_history:   nwRes.data  ?? [],
        wishlist_highlights: wishRes.data ?? [],
      });

      lastFetchedAt.current = Date.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [user, profile, dashboardData]);

  useEffect(() => {
    if (user) { fetchDashboard(); }
    else       { setDashboardData(null); lastFetchedAt.current = 0; }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FinanceContext.Provider
      value={{ dashboardData, loading, error, refetch: () => fetchDashboard(true), isAuthenticated: !!user, isLoading: loading }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance(): FinanceContextType {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used inside <FinanceProvider>');
  return ctx;
}
