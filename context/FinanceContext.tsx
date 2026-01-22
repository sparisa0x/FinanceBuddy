import React, { createContext, useContext, useEffect, useState } from 'react';
import { Transaction, Debt, Investment, WishlistItem, FinancialHealth } from '../types';
import { MOCK_DATA } from '../constants';

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
  login: (u: string, p: string) => boolean;
  logout: () => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // In a real app, these would be fetched from Firestore
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_DATA.transactions);
  const [debts, setDebts] = useState<Debt[]>(MOCK_DATA.debts);
  const [investments, setInvestments] = useState<Investment[]>(MOCK_DATA.investments);
  const [wishlist, setWishlist] = useState<WishlistItem[]>(MOCK_DATA.wishlist);
  const [healthScore, setHealthScore] = useState<FinancialHealth>({ 
    score: 0, status: 'Warning', color: '#f59e0b', factors: { savingsRate: 0, debtBurden: 0, emergencyCoverage: 0 } 
  });
  
  const [userName, setUserName] = useState("Buddy");
  const [creditScores, setCreditScores] = useState({ cibil: 750, experian: 780 });
  const currency = "₹";

  // Derived Analytics
  const totalAssets = investments.reduce((acc, curr) => acc + curr.currentValue, 0) + 
                      transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0) -
                      transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0); // Simplified Cash
  
  const totalDebt = debts.reduce((acc, d) => acc + d.remainingAmount, 0);
  const netWorth = totalAssets - totalDebt;
  const monthlyEMI = debts.reduce((acc, d) => d.isPaused ? acc : acc + d.monthlyEMI, 0);

  // Health Score Calculation Logic
  useEffect(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0) || 1;
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    
    // 1. Savings Rate (Target 20%+)
    const savings = totalIncome - totalExpenses;
    const savingsRate = Math.max(0, (savings / totalIncome) * 100);
    
    // 2. Debt Burden (EMI / Income should be < 30%)
    const debtBurden = (monthlyEMI / (totalIncome / 12)) * 100; // Approx monthly income
    
    // 3. Emergency Fund (Assets / Monthly Expense)
    const monthlyExpenseAvg = totalExpenses / 12 || 1; // Approx
    const emergencyCoverage = totalAssets / monthlyExpenseAvg;

    // Weighted Score
    let score = 50; // Base
    score += (savingsRate > 20 ? 20 : savingsRate);
    score -= (debtBurden > 30 ? (debtBurden - 30) : 0);
    score += (emergencyCoverage > 6 ? 15 : emergencyCoverage * 2);
    score -= (totalDebt > totalAssets ? 20 : 0);

    score = Math.min(100, Math.max(0, Math.round(score)));

    let status: FinancialHealth['status'] = 'Warning';
    let color = '#f59e0b'; // Orange

    if (score >= 80) { status = 'Excellent'; color = '#10b981'; } // Green
    else if (score >= 60) { status = 'Good'; color = '#3b82f6'; } // Blue
    else if (score < 40) { status = 'Critical'; color = '#ef4444'; } // Red

    setHealthScore({
      score,
      status,
      color,
      factors: { savingsRate, debtBurden, emergencyCoverage }
    });

  }, [transactions, debts, investments]);

  // Actions
  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const newT = { ...t, id: Math.random().toString(36).substr(2, 9) };
    setTransactions(prev => [newT, ...prev]);
  };

  const addDebt = (d: Omit<Debt, 'id' | 'remainingAmount'>) => {
    const newD = { ...d, id: Math.random().toString(36).substr(2, 9), remainingAmount: d.totalAmount };
    setDebts(prev => [...prev, newD]);
  };

  const updateDebt = (id: string, updatedDebt: Partial<Debt>) => {
    setDebts(prev => prev.map(d => d.id === id ? { ...d, ...updatedDebt } : d));
  };

  const deleteDebt = (id: string) => {
    setDebts(prev => prev.filter(d => d.id !== id));
  };

  const payEMI = (debtId: string, amount: number) => {
    // 1. Create Expense
    addTransaction({
      amount,
      type: 'expense',
      category: 'Debt Repayment',
      date: new Date().toISOString().split('T')[0],
      description: `EMI Payment`
    });

    // 2. Reduce Debt
    setDebts(prev => prev.map(d => {
      if (d.id === debtId) {
        return { ...d, remainingAmount: Math.max(0, d.remainingAmount - amount) };
      }
      return d;
    }));
  };

  const addInvestment = (i: Omit<Investment, 'id'>) => {
    setInvestments(prev => [...prev, { ...i, id: Math.random().toString(36).substr(2, 9) }]);
  };

  const addToWishlist = (w: Omit<WishlistItem, 'id' | 'status' | 'viewCount'>) => {
    setWishlist(prev => [...prev, { ...w, id: Math.random().toString(36).substr(2, 9), status: 'added', viewCount: 0 }]);
  };

  const updateWishlistItem = (id: string, updates: Partial<WishlistItem>) => {
    setWishlist(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const deleteWishlistItem = (id: string) => {
    setWishlist(prev => prev.filter(item => item.id !== id));
  };

  const updateCreditScores = (scores: { cibil: number; experian: number }) => {
    setCreditScores(scores);
  };

  // Auth Logic
  const login = (u: string, p: string) => {
    if (u === 'buddy' && p === '@123Buddy') {
      setIsAuthenticated(true);
      setUserName("Buddy");
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserName("Guest");
  };

  return (
    <FinanceContext.Provider value={{
      transactions, debts, investments, wishlist, currency, userName, setUserName,
      addTransaction, addDebt, updateDebt, deleteDebt, payEMI, addInvestment, addToWishlist, updateWishlistItem, deleteWishlistItem,
      healthScore, netWorth, totalDebt, monthlyEMI, creditScores, updateCreditScores,
      isAuthenticated, login, logout
    }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
