import { LayoutDashboard, Wallet, PiggyBank, TrendingUp, ShoppingBag, PieChart, Upload, Calendar, History, UserCircle, Shield } from 'lucide-react';

export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'calendar', label: 'Financial Calendar', icon: Calendar },
  { id: 'income-expense', label: 'Income & Expenses', icon: Wallet },
  { id: 'debts', label: 'Debts & EMI', icon: PiggyBank },
  { id: 'investments', label: 'Investments', icon: TrendingUp },
  { id: 'wishlist', label: 'Wishlist', icon: ShoppingBag },
  { id: 'history', label: 'Financial Archives', icon: History },
  { id: 'analytics', label: 'Deep Analytics', icon: PieChart },
  { id: 'profile', label: 'Profile & Security', icon: UserCircle },
  { id: 'import', label: 'Import Data', icon: Upload },
  { id: 'admin', label: 'Admin Panel', icon: Shield, adminOnly: true },
];

export const MOCK_DATA = {
  transactions: [
    { id: '1', amount: 5000, type: 'income', category: 'Salary', date: '2023-10-01', description: 'Monthly Salary' },
    { id: '2', amount: 1200, type: 'expense', category: 'Rent', date: '2023-10-02', description: 'Apartment Rent' },
    { id: '3', amount: 300, type: 'expense', category: 'Groceries', date: '2023-10-05', description: 'Weekly Groceries' },
  ] as any[],
  debts: [
    { id: 'd1', name: 'Student Loan', type: 'education', totalAmount: 50000, remainingAmount: 42000, interestRate: 5, monthlyEMI: 500, dueDate: 15, isPaused: false },
    { id: 'd2', name: 'Credit Card', type: 'credit_card', totalAmount: 2000, remainingAmount: 1500, interestRate: 18, monthlyEMI: 200, dueDate: 5, isPaused: false },
  ] as any[],
  investments: [
    { id: 'i1', name: 'Tech ETF', type: 'stock', investedAmount: 10000, currentValue: 12500, lastUpdated: '2023-10-01' },
    { id: 'i2', name: 'Bitcoin', type: 'crypto', investedAmount: 5000, currentValue: 4200, lastUpdated: '2023-10-01' },
  ] as any[],
  wishlist: [
    { id: 'w1', name: 'Gaming Laptop', category: 'want', estimatedCost: 1500, priority: 'high', status: 'viewed', viewCount: 12 },
    { id: 'w2', name: 'New Car', category: 'luxury', estimatedCost: 35000, priority: 'low', status: 'planned', viewCount: 5 },
  ] as any[]
};