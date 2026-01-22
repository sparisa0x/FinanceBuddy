export type TransactionType = 'income' | 'expense';
export type DebtType = 'education' | 'bank' | 'credit_card' | 'family' | 'informal';
export type InvestmentType = 'stock' | 'mutual_fund' | 'crypto' | 'fd' | 'gold' | 'real_estate' | 'custom';
export type WishlistCategory = 'need' | 'want' | 'luxury';
export type WishlistStatus = 'added' | 'viewed' | 'planned' | 'purchased';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description: string;
  isRecurring?: boolean;
}

export interface Debt {
  id: string;
  name: string;
  type: DebtType;
  totalAmount: number;
  remainingAmount: number;
  interestRate: number;
  monthlyEMI: number;
  dueDate: number; // Day of month
  isPaused: boolean;
}

export interface Investment {
  id: string;
  name: string;
  type: InvestmentType;
  investedAmount: number;
  currentValue: number;
  lastUpdated: string;
}

export interface WishlistItem {
  id: string;
  name: string;
  category: WishlistCategory;
  estimatedCost: number;
  priority: 'low' | 'medium' | 'high';
  status: WishlistStatus;
  viewCount: number;
}

export interface FinancialHealth {
  score: number; // 0-100
  status: 'Critical' | 'Warning' | 'Good' | 'Excellent';
  color: string; // hex or tailwind class
  factors: {
    savingsRate: number;
    debtBurden: number;
    emergencyCoverage: number;
  };
}
