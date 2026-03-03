/**
 * Pure financial calculation helpers — no side effects, no DB access.
 */

/**
 * Calculate monthly EMI using reducing balance formula.
 * @param {number} principal   – outstanding loan amount
 * @param {number} annualRate  – annual interest rate in percent (e.g. 8.5)
 * @param {number} months      – remaining tenure in months
 * @returns {number}           – monthly EMI rounded to 2 decimal places
 */
export function calculateEMI(principal, annualRate, months) {
  if (months <= 0 || principal <= 0) return 0;
  if (annualRate === 0) return parseFloat((principal / months).toFixed(2));

  const r = annualRate / 12 / 100;
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return parseFloat(emi.toFixed(2));
}

/**
 * Calculate financial health score (0–100).
 *
 * Scoring breakdown:
 *   Debt burden        (30 pts) – emi/income < 30% → 30, < 50% → 15, else 0
 *   Emergency fund     (25 pts) – savings/monthly_expense ≥ 6 → 25, ≥ 3 → 15, ≥ 1 → 5
 *   Investment rate    (25 pts) – invested/income ≥ 20% → 25, ≥ 10% → 15, > 0 → 5
 *   Expense discipline (20 pts) – expense/income ≤ 50% → 20, ≤ 70% → 10, else 0
 *
 * @param {{
 *   monthly_income: number,
 *   total_monthly_emi: number,
 *   monthly_expense: number,
 *   total_savings: number,
 *   total_invested: number
 * }} params
 * @returns {number} – integer score 0–100
 */
export function calculateHealthScore({
  monthly_income,
  total_monthly_emi,
  monthly_expense,
  total_savings,
  total_invested
}) {
  if (!monthly_income || monthly_income <= 0) return 0;

  let score = 0;

  // Debt burden (30 pts)
  const emiRatio = total_monthly_emi / monthly_income;
  if      (emiRatio < 0.30) score += 30;
  else if (emiRatio < 0.50) score += 15;

  // Emergency fund (25 pts)
  const monthsOfExpense = monthly_expense > 0 ? total_savings / monthly_expense : 0;
  if      (monthsOfExpense >= 6) score += 25;
  else if (monthsOfExpense >= 3) score += 15;
  else if (monthsOfExpense >= 1) score += 5;

  // Investment rate (25 pts)
  const investRate = total_invested / monthly_income;
  if      (investRate >= 0.20) score += 25;
  else if (investRate >= 0.10) score += 15;
  else if (investRate >  0)    score += 5;

  // Expense discipline (20 pts)
  const expenseRatio = monthly_expense / monthly_income;
  if      (expenseRatio <= 0.50) score += 20;
  else if (expenseRatio <= 0.70) score += 10;

  return Math.min(Math.round(score), 100);
}

/**
 * Upsert a net-worth snapshot row for today's date (one row per user per day).
 * @param {string} userId
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function saveNetWorthSnapshot(userId, supabase) {
  // Fetch investment totals
  const { data: investments, error: invErr } = await supabase
    .from('investments')
    .select('current_value')
    .eq('user_id', userId);
  if (invErr) throw invErr;

  // Fetch debt totals
  const { data: debts, error: debtErr } = await supabase
    .from('debts')
    .select('outstanding_principal')
    .eq('user_id', userId);
  if (debtErr) throw debtErr;

  const totalAssets = (investments || []).reduce((s, i) => s + Number(i.current_value), 0);
  const totalDebts  = (debts || []).reduce((s, d) => s + Number(d.outstanding_principal), 0);
  const netWorth    = totalAssets - totalDebts;

  const today = new Date().toISOString().split('T')[0];

  const { error: upsertErr } = await supabase
    .from('net_worth_snapshots')
    .upsert(
      {
        user_id:       userId,
        snapshot_date: today,
        net_worth:     netWorth,
        total_assets:  totalAssets,
        total_debts:   totalDebts
      },
      { onConflict: 'user_id,snapshot_date', ignoreDuplicates: false }
    );

  if (upsertErr) throw upsertErr;
}
