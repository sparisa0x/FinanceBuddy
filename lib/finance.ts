/** EMI calculator — reducing balance (flat if rate = 0) */
export function calculateEMI(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate === 0) return Math.round(principal / months);
  const r = annualRate / 100 / 12;
  return Math.round((principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
}

interface HealthInput {
  monthly_income: number;
  total_monthly_emi: number;
  monthly_expense: number;
  total_savings: number;
  total_invested: number;
}

/** Financial health score 0–100 */
export function calculateHealthScore({
  monthly_income,
  total_monthly_emi,
  monthly_expense,
  total_savings,
  total_invested,
}: HealthInput): number {
  if (monthly_income <= 0) return 0;
  let score = 100;

  // EMI burden penalty
  const emiBurden = total_monthly_emi / monthly_income;
  if (emiBurden > 0.5)      score -= 30;
  else if (emiBurden > 0.3) score -= 15;
  else if (emiBurden > 0.1) score -= 5;

  // Savings rate penalty
  const savingsRate = (monthly_income - monthly_expense) / monthly_income;
  if (savingsRate < 0)       score -= 25;
  else if (savingsRate < 0.1) score -= 15;
  else if (savingsRate < 0.2) score -= 5;

  // No investments
  if (total_invested === 0) score -= 10;

  // Emergency fund (months of expenses covered)
  const emergencyMonths = monthly_expense > 0 ? total_savings / monthly_expense : 0;
  if (emergencyMonths < 1)      score -= 20;
  else if (emergencyMonths < 3) score -= 10;
  else if (emergencyMonths < 6) score -= 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}
