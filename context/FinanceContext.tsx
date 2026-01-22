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
  isAdmin: boolean; // New State
  login: (u: string, p: string) => Promise<{success: boolean; message?: string}>;
  register: (u: string, p: string, name: string, email: string) => Promise<{success: boolean; message?: string}>;
  changePassword: (newPass: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
  
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
  const [isLoading, setIsLoading] = useState(false);
  
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
    
    // 1. Optimistic UI Update
    if(newData.transactions) setTransactions(newData.transactions);
    if(newData.debts) setDebts(newData.debts);
    if(newData.investments) setInvestments(newData.investments);
    if(newData.wishlist) setWishlist(newData.wishlist);
    if(newData.creditScores) setCreditScores(newData.creditScores);
    if(newData.displayName) setUserName(newData.displayName);

    // Prepare payload
    const payload = {
       transactions: newData.transactions || transactions,
       debts: newData.debts || debts,
       investments: newData.investments || investments,
       wishlist: newData.wishlist || wishlist,
       creditScores: newData.creditScores || creditScores,
       displayName: newData.displayName || userName,
       password: newData.password // Optional
    };

    // 2. Attempt Local Storage Sync (Offline First)
    try {
      const storageKey = `finance_user_${authCreds.u}`;
      const currentData = JSON.parse(localStorage.getItem(storageKey) || '{}');
      localStorage.setItem(storageKey, JSON.stringify({ ...currentData, ...payload }));
    } catch (e) {
      console.error("Local save failed", e);
    }

    // 3. Attempt Cloud Sync
    try {
      const res = await fetch('/api/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: authCreds.u,
          data: payload 
        })
      });
      if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
         await res.json();
      }
    } catch (e) {
      console.warn("Cloud sync failed, data saved locally only.");
    }
  };

  // Health Score Calculation Logic
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

    const updatedDebts = debts.map(d => {
      if (d.id === debtId) {
        return { ...d, remainingAmount: Math.max(0, d.remainingAmount - amount) };
      }
      return d;
    });

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
       // Update local auth creds
       setAuthCreds(prev => ({ ...prev, p: newPass }));
       return true;
     } catch (e) {
       return false;
     }
  };

  // ADMIN ACTIONS
  const fetchPendingUsers = async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/finance?action=pending_users');
      const data = await res.json();
      if (data.success) {
        setPendingUsers(data.data);
      }
    } catch (e) {
      console.error("Failed to fetch pending users", e);
    }
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
    } catch (e) {
      return false;
    }
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
    } catch (e) {
      return false;
    }
  };

  // Auth Logic
  const login = async (u: string, p: string) => {
    setIsLoading(true);
    try {
      // 0. Super Admin Backdoor (Guarantees access even if API is down)
      if (u === 'buddy' && p === '@123Buddy') {
          setIsAuthenticated(true);
          setUserName("Super Admin");
          setIsAdmin(true);
          setAuthCreds({ u, p });
          // Empty initial data for super admin if not fetched
          setTransactions([]);
          setDebts([]);
          setInvestments([]);
          setWishlist([]);
          setCreditScores({ cibil: 900, experian: 900 });
          setIsLoading(false);
          return { success: true };
      }

      // 1. Check LocalStorage First (Offline support)
      const localData = localStorage.getItem(`finance_user_${u}`);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (parsed.password && parsed.password === p) {
           // Success Local Login
           setIsAuthenticated(true);
           setUserName(parsed.displayName || "User");
           setIsAdmin(parsed.isAdmin || false); // Local admin check
           setAuthCreds({ u, p });
           setTransactions(parsed.transactions || []);
           setDebts(parsed.debts || []);
           setInvestments(parsed.investments || []);
           setWishlist(parsed.wishlist || []);
           setCreditScores(parsed.creditScores || { cibil: 750, experian: 780 });
           setIsLoading(false);
           return { success: true };
        } else if (parsed.password) {
           setIsLoading(false);
           return { success: false, message: 'Invalid password (offline check)' };
        }
      }

      // 2. Attempt Cloud Login
      const res = await fetch(`/api/finance?username=${u}&password=${p}`);
      
      // Ensure we have a valid JSON response
      if (!res.ok) {
        if (res.status === 403) {
           return { success: false, message: 'Account pending approval. Please wait for admin verification email.' };
        }
        throw new Error(`Server returned ${res.status}`);
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid server response (not JSON)");
      }

      const data = await res.json();

      if (data.success) {
        setIsAuthenticated(true);
        setUserName(data.data.displayName || "Sriram Parisa");
        setIsAdmin(data.data.isAdmin || false);
        setAuthCreds({ u, p });

        const dbData = data.data;
        setTransactions(dbData.transactions || []);
        setDebts(dbData.debts || []);
        setInvestments(dbData.investments || []);
        setWishlist(dbData.wishlist || []);
        setCreditScores(dbData.creditScores || { cibil: 750, experian: 780 });
        
        // Sync cloud data to local for future offline use
        localStorage.setItem(`finance_user_${u}`, JSON.stringify({ ...dbData, password: p }));

        return { success: true };
      }
      return { success: false, message: data.message || 'Login failed' };
    } catch (err) {
      console.warn("Login fallback mode due to:", err);
      return { success: false, message: 'Connection Error. Please ensure you are registered.' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (u: string, p: string, name: string, email: string) => {
    setIsLoading(true);
    
    // Save locally first (Optimistic) - BUT for register halt we might not want this?
    // User wants to HALT. So local storage shouldn't just let them in.
    // However, existing logic allowed offline fallback. We should probably disable offline register login if we want to enforce approval.
    // We will save to local, but mark as NOT authenticated in local logic until approved.

    try {
      const res = await fetch(`/api/finance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           action: 'register', 
           username: u, 
           password: p, 
           displayName: name,
           email: email 
        })
      });

      if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
         const data = await res.json();
         if (data.success) {
             // If Admin (auto-approved), login immediately
             if (data.data.isApproved) {
                 return login(u, p);
             }
             // Else, tell them to wait
             return { success: true, message: 'Registration successful! Please wait for admin approval (Email sent to admin).' };
         } else {
             return { success: false, message: data.message };
         }
      }
      
      return { success: false, message: "Registration failed or server offline." };

    } catch (err) {
      console.warn("Registration offline mode failed");
      return { success: false, message: 'Server connection required for registration.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUserName("Guest");
    setTransactions([]);
    setDebts([]);
    setInvestments([]);
    setAuthCreds({ u: '', p: '' });
  };

  return (
    <FinanceContext.Provider value={{
      transactions, debts, investments, wishlist, currency, userName, setUserName,
      addTransaction, addDebt, updateDebt, deleteDebt, payEMI, addInvestment, addToWishlist, updateWishlistItem, deleteWishlistItem,
      healthScore, netWorth, totalDebt, monthlyEMI, creditScores, updateCreditScores,
      isAuthenticated, isAdmin, login, register, changePassword, logout, isLoading,
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