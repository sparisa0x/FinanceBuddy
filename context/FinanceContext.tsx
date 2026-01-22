import React, { createContext, useContext, useEffect, useState } from 'react';
import { Transaction, Debt, Investment, WishlistItem, FinancialHealth } from '../types';

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
  login: (u: string, p: string) => Promise<{success: boolean; message?: string}>;
  register: (u: string, p: string, name: string, email: string) => Promise<{success: boolean; message?: string}>;
  changePassword: (newPass: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  isCloudConnected: boolean;
  
  // Admin Functions
  pendingUsers: any[];
  fetchPendingUsers: () => Promise<void>;
  approveUser: (username: string) => Promise<boolean>;
  rejectUser: (username: string) => Promise<boolean>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authCreds, setAuthCreds] = useState({ u: '', p: '' });
  const [isLoading, setIsLoading] = useState(true); 
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  
  // Admin State
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [creditScores, setCreditScores] = useState({ cibil: 750, experian: 780 });
  
  const [healthScore, setHealthScore] = useState<FinancialHealth>({ 
    score: 0, status: 'Warning', color: '#f59e0b', factors: { savingsRate: 0, debtBurden: 0, emergencyCoverage: 0 } 
  });
  
  const [userName, setUserName] = useState("Sriram Parisa");
  const currency = "₹";

  // Auth & Data Initialization Logic
  useEffect(() => {
    const initApp = async () => {
      setIsLoading(true);
      
      // 1. Check connectivity
      let connected = false;
      try {
        const res = await fetch('/api/finance?action=ping');
        if (res.ok) {
          setIsCloudConnected(true);
          connected = true;
        }
      } catch (e) {
        console.log("Offline mode detected initially");
      }

      // 2. Restore Session
      const savedSession = localStorage.getItem('finance_session');
      if (savedSession) {
        try {
          const { u, p } = JSON.parse(savedSession);
          if (u && p) {
            console.log("Restoring session for:", u);
            // Attempt login (fetches data)
            await loginInternal(u, p, connected); 
          } else {
             setIsLoading(false);
          }
        } catch (e) {
          localStorage.removeItem('finance_session');
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    initApp();
  }, []);

  // Internal Login function to reuse logic without triggering loop
  const loginInternal = async (u: string, p: string, cloudAvailable: boolean) => {
      // 0. Super Admin Backdoor
      if (u === 'buddy' && p === '@123Buddy') {
          setIsAuthenticated(true);
          setUserName("Super Admin");
          setIsAdmin(true);
          setAuthCreds({ u, p });
          setTransactions([]); setDebts([]); setInvestments([]); setWishlist([]);
          setCreditScores({ cibil: 900, experian: 900 });
          localStorage.setItem('finance_session', JSON.stringify({ u, p }));
          setIsLoading(false);
          return { success: true };
      }

      // 1. Cloud Login
      if (cloudAvailable) {
        try {
          const res = await fetch(`/api/finance?username=${u}&password=${p}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              const dbData = data.data;
              
              setIsAuthenticated(true);
              setUserName(dbData.displayName || "User");
              setIsAdmin(dbData.isAdmin || false);
              setAuthCreds({ u, p });

              // Update State
              if (dbData.transactions) setTransactions(dbData.transactions);
              if (dbData.debts) setDebts(dbData.debts);
              if (dbData.investments) setInvestments(dbData.investments);
              if (dbData.wishlist) setWishlist(dbData.wishlist);
              if (dbData.creditScores) setCreditScores(dbData.creditScores);

              // Cache
              localStorage.setItem('finance_session', JSON.stringify({ u, p }));
              localStorage.setItem(`finance_user_${u}`, JSON.stringify({ ...dbData, password: p }));
              
              setIsLoading(false);
              return { success: true };
            }
          }
        } catch (e) {
          console.warn("Cloud login failed during restore, falling back to local");
        }
      }

      // 2. Local Fallback
      const localData = localStorage.getItem(`finance_user_${u}`);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (parsed.password === p) {
           setIsAuthenticated(true);
           setUserName(parsed.displayName || "User (Offline)");
           setIsAdmin(parsed.isAdmin || false);
           setAuthCreds({ u, p });
           
           setTransactions(parsed.transactions || []);
           setDebts(parsed.debts || []);
           setInvestments(parsed.investments || []);
           setWishlist(parsed.wishlist || []);
           setCreditScores(parsed.creditScores || { cibil: 750, experian: 780 });

           localStorage.setItem('finance_session', JSON.stringify({ u, p }));
           setIsLoading(false);
           return { success: true, message: "Logged in (Offline Mode)" };
        }
      }

      setIsLoading(false);
      return { success: false, message: "Login failed" };
  };

  // Public Login Wrapper
  const login = async (u: string, p: string) => {
    setIsLoading(true);
    // Re-check cloud connectivity before login
    let connected = isCloudConnected;
    if(!connected) {
       try {
         const res = await fetch('/api/finance?action=ping');
         if(res.ok) { setIsCloudConnected(true); connected = true; }
       } catch(e) {}
    }
    return loginInternal(u, p, connected);
  };

  // Derived Analytics
  const totalAssets = investments.reduce((acc, curr) => acc + curr.currentValue, 0) + 
                      transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0) -
                      transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0); 
  
  const totalDebt = debts.reduce((acc, d) => acc + d.remainingAmount, 0);
  const netWorth = totalAssets - totalDebt;
  const monthlyEMI = debts.reduce((acc, d) => d.isPaused ? acc : acc + d.monthlyEMI, 0);

  // Sync Data Helper
  const syncData = async (newData: any) => {
    if (!isAuthenticated) return;
    
    // 1. Optimistic Update
    if(newData.transactions) setTransactions(newData.transactions);
    if(newData.debts) setDebts(newData.debts);
    if(newData.investments) setInvestments(newData.investments);
    if(newData.wishlist) setWishlist(newData.wishlist);
    if(newData.creditScores) setCreditScores(newData.creditScores);
    if(newData.displayName) setUserName(newData.displayName);

    const payload = {
       transactions: newData.transactions || transactions,
       debts: newData.debts || debts,
       investments: newData.investments || investments,
       wishlist: newData.wishlist || wishlist,
       creditScores: newData.creditScores || creditScores,
       displayName: newData.displayName || userName,
       password: newData.password 
    };

    // 2. Local Save
    try {
      const storageKey = `finance_user_${authCreds.u}`;
      const currentData = JSON.parse(localStorage.getItem(storageKey) || '{}');
      localStorage.setItem(storageKey, JSON.stringify({ ...currentData, ...payload }));
    } catch (e) { console.error(e); }

    // 3. Cloud Sync
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authCreds.u, data: payload })
      });
      if (res.ok) setIsCloudConnected(true);
    } catch (e) {
      console.warn("Cloud sync failed");
      setIsCloudConnected(false);
    }
  };

  // Health Score Logic
  useEffect(() => {
    const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0) || 1;
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    
    const savings = totalIncome - totalExpenses;
    const savingsRate = Math.max(0, (savings / totalIncome) * 100);
    const debtBurden = (monthlyEMI / (totalIncome / 12)) * 100;
    const monthlyExpenseAvg = totalExpenses / 12 || 1;
    const emergencyCoverage = totalAssets / monthlyExpenseAvg;

    let score = 50; 
    score += (savingsRate > 20 ? 20 : savingsRate);
    score -= (debtBurden > 30 ? (debtBurden - 30) : 0);
    score += (emergencyCoverage > 6 ? 15 : emergencyCoverage * 2);
    score -= (totalDebt > totalAssets ? 20 : 0);
    score = Math.min(100, Math.max(0, Math.round(score)));

    let status: FinancialHealth['status'] = 'Warning';
    let color = '#f59e0b'; // Orange

    if (score >= 80) { status = 'Excellent'; color = '#10b981'; } 
    else if (score >= 60) { status = 'Good'; color = '#3b82f6'; } 
    else if (score < 40) { status = 'Critical'; color = '#ef4444'; } 

    setHealthScore({
      score,
      status,
      color,
      factors: { savingsRate, debtBurden, emergencyCoverage }
    });

  }, [transactions, debts, investments, totalAssets, monthlyEMI, totalDebt]);

  // Actions
  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const newT = { ...t, id: Math.random().toString(36).substr(2, 9) };
    const newHistory = [newT, ...transactions];
    syncData({ transactions: newHistory });
  };

  const addDebt = (d: Omit<Debt, 'id' | 'remainingAmount'>) => {
    const newD = { ...d, id: Math.random().toString(36).substr(2, 9), remainingAmount: d.totalAmount };
    const newDebts = [...debts, newD];
    syncData({ debts: newDebts });
  };

  const updateDebt = (id: string, updatedDebt: Partial<Debt>) => {
    const newDebts = debts.map(d => d.id === id ? { ...d, ...updatedDebt } : d);
    syncData({ debts: newDebts });
  };

  const deleteDebt = (id: string) => {
    const newDebts = debts.filter(d => d.id !== id);
    syncData({ debts: newDebts });
  };

  const payEMI = (debtId: string, amount: number) => {
    const newTrans = {
      id: Math.random().toString(36).substr(2, 9),
      amount,
      type: 'expense' as const,
      category: 'Debt Repayment',
      date: new Date().toISOString().split('T')[0],
      description: `EMI Payment`
    };
    const updatedTransactions = [newTrans, ...transactions];
    const updatedDebts = debts.map(d => d.id === debtId ? { ...d, remainingAmount: Math.max(0, d.remainingAmount - amount) } : d);
    syncData({ transactions: updatedTransactions, debts: updatedDebts });
  };

  const addInvestment = (i: Omit<Investment, 'id'>) => {
    const newInv = { ...i, id: Math.random().toString(36).substr(2, 9) };
    const updatedInv = [...investments, newInv];
    syncData({ investments: updatedInv });
  };

  const addToWishlist = (w: Omit<WishlistItem, 'id' | 'status' | 'viewCount'>) => {
    const newW = { ...w, id: Math.random().toString(36).substr(2, 9), status: 'added' as const, viewCount: 0 };
    const updatedWish = [...wishlist, newW];
    syncData({ wishlist: updatedWish });
  };

  const updateWishlistItem = (id: string, updates: Partial<WishlistItem>) => {
    const updatedWish = wishlist.map(item => item.id === id ? { ...item, ...updates } : item);
    syncData({ wishlist: updatedWish });
  };

  const deleteWishlistItem = (id: string) => {
    const updatedWish = wishlist.filter(item => item.id !== id);
    syncData({ wishlist: updatedWish });
  };

  const updateCreditScores = (scores: { cibil: number; experian: number }) => {
    syncData({ creditScores: scores });
  };

  const changePassword = async (newPass: string) => {
     try {
       await syncData({ password: newPass });
       setAuthCreds(prev => ({ ...prev, p: newPass }));
       localStorage.setItem('finance_session', JSON.stringify({ u: authCreds.u, p: newPass }));
       return true;
     } catch (e) { return false; }
  };

  const fetchPendingUsers = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/finance?action=pending_users');
      const data = await res.json();
      if (data.success) setPendingUsers(data.data);
    } catch (e) {}
  };

  const approveUser = async (targetUsername: string) => {
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'approve_user', decision: 'approve', targetUsername })
      });
      const data = await res.json();
      if (data.success) {
        setPendingUsers(prev => prev.filter(u => u.username !== targetUsername));
        return true;
      }
      return false;
    } catch (e) { return false; }
  };

  const rejectUser = async (targetUsername: string) => {
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action: 'approve_user', decision: 'reject', targetUsername })
      });
      const data = await res.json();
      if (data.success) {
        setPendingUsers(prev => prev.filter(u => u.username !== targetUsername));
        return true;
      }
      return false;
    } catch (e) { return false; }
  };

  const register = async (u: string, p: string, name: string, email: string) => {
    try {
      const res = await fetch(`/api/finance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', username: u, password: p, displayName: name, email: email })
      });
      const data = await res.json();
      if (res.ok && data.success) {
         if (data.data.isApproved) return login(u, p);
         return { success: true, message: 'Registration successful! Please wait for admin approval.' };
      }
      return { success: false, message: data.message || "Registration failed" };
    } catch (err) {
      return { success: false, message: 'Connection failed.' };
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUserName("Guest");
    setTransactions([]); setDebts([]); setInvestments([]);
    setAuthCreds({ u: '', p: '' });
    localStorage.removeItem('finance_session');
  };

  return (
    <FinanceContext.Provider value={{
      transactions, debts, investments, wishlist, currency, userName, setUserName,
      addTransaction, addDebt, updateDebt, deleteDebt, payEMI, addInvestment, addToWishlist, updateWishlistItem, deleteWishlistItem,
      healthScore, netWorth, totalDebt, monthlyEMI, creditScores, updateCreditScores,
      isAuthenticated, isAdmin, login, register, changePassword, logout, isLoading, isCloudConnected,
      pendingUsers, fetchPendingUsers, approveUser, rejectUser
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