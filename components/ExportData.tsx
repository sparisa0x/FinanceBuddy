import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface Transaction {
  date: string;
  type: string;
  category: string;
  amount: number;
  description: string | null;
}

interface Debt {
  name: string;
  principal: number;
  outstanding_principal: number;
  annual_rate: number;
  monthly_emi: number;
  lender: string | null;
}

interface Investment {
  name: string;
  type: string;
  invested_amount: number;
  current_value: number;
  gain_loss: number;
  gain_loss_pct: number;
  date: string;
}

const toCSV = (rows: Record<string, unknown>[]): string => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = rows.map(r =>
    headers.map(h => {
      const v = String(r[h] ?? '');
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')
  );
  return [headers.join(','), ...lines].join('\n');
};

const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const ExportData: React.FC = () => {
  const [exporting, setExporting] = useState<string | null>(null);
  const { user } = useAuth();

  const exportTransactions = async () => {
    setExporting('transactions');
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('date, type, category, amount, description')
        .eq('user_id', user!.id)
        .order('date', { ascending: false });
      if (error) throw error;
      downloadCSV(toCSV((data ?? []) as unknown as Record<string, unknown>[]), 'transactions.csv');
      toast.success('Transactions exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const exportDebts = async () => {
    setExporting('debts');
    try {
      const { data, error } = await supabase
        .from('debts')
        .select('name, principal, outstanding_principal, annual_rate, monthly_emi, lender')
        .eq('user_id', user!.id);
      if (error) throw error;
      downloadCSV(toCSV((data ?? []) as unknown as Record<string, unknown>[]), 'debts.csv');
      toast.success('Debts exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const exportInvestments = async () => {
    setExporting('investments');
    try {
      const { data, error } = await supabase
        .from('investments')
        .select('name, type, invested_amount, current_value, date')
        .eq('user_id', user!.id);
      if (error) throw error;
      downloadCSV(toCSV((data ?? []) as unknown as Record<string, unknown>[]), 'investments.csv');
      toast.success('Investments exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const exportAll = async () => {
    setExporting('all');
    try {
      const [{ data: tx }, { data: debts }, { data: inv }] = await Promise.all([
        supabase.from('transactions').select('date, type, category, amount, description').eq('user_id', user!.id).order('date', { ascending: false }),
        supabase.from('debts').select('name, principal, outstanding_principal, annual_rate, monthly_emi, lender').eq('user_id', user!.id),
        supabase.from('investments').select('name, type, invested_amount, current_value, date').eq('user_id', user!.id),
      ]);
      downloadCSV(toCSV((tx   ?? []) as unknown as Record<string, unknown>[]), 'financebuddy_transactions.csv');
      downloadCSV(toCSV((debts ?? []) as unknown as Record<string, unknown>[]), 'financebuddy_debts.csv');
      downloadCSV(toCSV((inv  ?? []) as unknown as Record<string, unknown>[]), 'financebuddy_investments.csv');
      toast.success('All data exported (3 files)');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const btn = (label: string, key: string, fn: () => void) => (
    <button
      key={key}
      onClick={fn}
      disabled={exporting !== null}
      className="flex items-center justify-between rounded-xl bg-slate-800 border border-slate-700 px-5 py-4 text-sm font-medium text-white hover:border-indigo-500 hover:bg-slate-700 disabled:opacity-60 transition-colors"
    >
      <span>{label}</span>
      {exporting === key
        ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
        : <Download className="h-4 w-4 text-slate-400" />}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Export Data</h1>
        <p className="text-sm text-slate-500 mt-1">Download your financial data as CSV files</p>
      </div>

      <div className="space-y-3">
        {btn('Export Transactions',         'transactions', exportTransactions)}
        {btn('Export Debts & EMI',          'debts',        exportDebts)}
        {btn('Export Investments',          'investments',  exportInvestments)}
        <button
          onClick={exportAll}
          disabled={exporting !== null}
          className="flex items-center justify-between w-full rounded-xl bg-indigo-600 border border-indigo-500 px-5 py-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors"
        >
          <span>Export Everything</span>
          {exporting === 'all'
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Download className="h-4 w-4" />}
        </button>
      </div>

      <p className="text-xs text-slate-600">
        All CSV files use UTF-8 encoding and are compatible with Excel, Google Sheets, and other spreadsheet applications.
      </p>
    </div>
  );
};
