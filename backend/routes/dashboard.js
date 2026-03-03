import { Router } from 'express';
import supabase from '../lib/supabase.js';
import authenticate from '../middleware/authenticate.js';
import { calculateEMI, calculateHealthScore } from '../lib/calculations.js';

const router = Router();

// GET /api/dashboard – all data in one call
router.get('/', authenticate, async (req, res) => {
  const userId = req.userId;

  // Current month boundaries
  const now     = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Fetch everything in parallel
  const [
    profileRes,
    transactionsRes,
    monthlyIncomeRes,
    monthlyExpenseRes,
    debtsRes,
    investmentsRes,
    creditRes,
    historyRes,
    wishlistRes
  ] = await Promise.all([
    supabase.from('profiles').select('name, monthly_income, monthly_savings_target').eq('id', userId).single(),
    supabase.from('transactions').select('id, amount, type, category, description, date').eq('user_id', userId).order('date', { ascending: false }).limit(5),
    supabase.from('transactions').select('amount').eq('user_id', userId).eq('type', 'income').gte('date', monthStart).lte('date', monthEnd),
    supabase.from('transactions').select('amount').eq('user_id', userId).eq('type', 'expense').gte('date', monthStart).lte('date', monthEnd),
    supabase.from('debts').select('*').eq('user_id', userId),
    supabase.from('investments').select('*').eq('user_id', userId),
    supabase.from('credit_scores').select('cibil, experian').eq('user_id', userId).maybeSingle(),
    supabase.from('net_worth_snapshots').select('snapshot_date, net_worth').eq('user_id', userId).order('snapshot_date', { ascending: false }).limit(12),
    supabase.from('wishlist').select('*').eq('user_id', userId).eq('priority', 'high').eq('is_purchased', false).limit(3)
  ]);

  // Surface any fatal errors
  for (const res of [profileRes, transactionsRes, debtsRes, investmentsRes]) {
    if (res.error) return res.status(500).json({ error: res.error.message });
  }

  const profile      = profileRes.data || {};
  const debts        = debtsRes.data || [];
  const investments  = investmentsRes.data || [];
  const monthlyIncome  = (monthlyIncomeRes.data || []).reduce((s, r) => s + Number(r.amount), 0);
  const monthlyExpense = (monthlyExpenseRes.data || []).reduce((s, r) => s + Number(r.amount), 0);

  const totalInvested = investments.reduce((s, i) => s + Number(i.current_value), 0);
  const totalDebt     = debts.reduce((s, d) => s + Number(d.outstanding_principal), 0);
  const netWorth      = totalInvested - totalDebt;

  const debtsWithEMI = debts.map(d => ({
    ...d,
    monthly_emi: calculateEMI(Number(d.outstanding_principal), Number(d.annual_rate), Number(d.tenure_months))
  }));

  const totalMonthlyEMI = debtsWithEMI.reduce((s, d) => s + d.monthly_emi, 0);
  const emiBurdenPct    = profile.monthly_income > 0
    ? parseFloat(((totalMonthlyEMI / Number(profile.monthly_income)) * 100).toFixed(1))
    : 0;

  const savings = Math.max(0, monthlyIncome - monthlyExpense);
  const emergencyFundMonths = monthlyExpense > 0
    ? parseFloat((savings / monthlyExpense).toFixed(1))
    : 0;

  const healthScore = calculateHealthScore({
    monthly_income:    Number(profile.monthly_income) || monthlyIncome,
    total_monthly_emi: totalMonthlyEMI,
    monthly_expense:   monthlyExpense,
    total_savings:     savings,
    total_invested:    totalInvested
  });

  res.json({
    profile: {
      name:                    profile.name,
      monthly_income:          profile.monthly_income,
      monthly_savings_target:  profile.monthly_savings_target
    },
    summary: {
      net_worth:              parseFloat(netWorth.toFixed(2)),
      total_income_month:     parseFloat(monthlyIncome.toFixed(2)),
      total_expense_month:    parseFloat(monthlyExpense.toFixed(2)),
      total_debt:             parseFloat(totalDebt.toFixed(2)),
      total_invested:         parseFloat(totalInvested.toFixed(2)),
      health_score:           healthScore,
      emi_burden_pct:         emiBurdenPct,
      emergency_fund_months:  emergencyFundMonths
    },
    recent_transactions:  transactionsRes.data || [],
    debts_with_emi:       debtsWithEMI,
    credit_scores:        creditRes.data || { cibil: null, experian: null },
    net_worth_history:    (historyRes.data || []).reverse(), // chronological
    wishlist_highlights:  wishlistRes.data || []
  });
});

export default router;
