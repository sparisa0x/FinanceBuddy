import { LayoutDashboard, Wallet, PiggyBank, TrendingUp, ShoppingBag, PieChart, Upload, Calendar, History, UserCircle, Shield } from 'lucide-react';

export const MENU_ITEMS = [
  { id: 'dashboard',      label: 'Dashboard',          icon: LayoutDashboard },
  { id: 'calendar',       label: 'Financial Calendar', icon: Calendar },
  { id: 'income-expense', label: 'Income & Expenses',  icon: Wallet },
  { id: 'debts',          label: 'Debts & EMI',        icon: PiggyBank },
  { id: 'investments',    label: 'Investments',        icon: TrendingUp },
  { id: 'wishlist',       label: 'Wishlist',           icon: ShoppingBag },
  { id: 'history',        label: 'Financial Archives', icon: History },
  { id: 'analytics',      label: 'Deep Analytics',     icon: PieChart },
  { id: 'export',         label: 'Export Data',        icon: Upload },
  { id: 'profile',        label: 'Profile & Security', icon: UserCircle },
  { id: 'admin',          label: 'Admin Panel',        icon: Shield, adminOnly: true },
];
