import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

const Skeleton = () => <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-700" />;

const StatCard = ({ label, value, loading }: { label: string; value: string; loading: boolean }) => (
  <div className="rounded-xl bg-slate-800 border border-slate-700 p-5">
    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
    {loading ? <Skeleton /> : <p className="text-2xl font-bold text-white">{value}</p>}
  </div>
);

function HealthRing({ score, loading }: { score: number; loading: boolean }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#6366f1' : score >= 40 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Warning' : 'Critical';
  if (loading) return <div className="h-32 w-32 animate-pulse rounded-full bg-slate-700" />;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      <circle cx="64" cy="64" r={r} fill="none" stroke="#1e293b" strokeWidth="10" />
      <circle
        cx="64" cy="64" r={r} fill="none"
        stroke={color} strokeWidth="10"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={"rotate(-90 64 64)"}
      />
      <text x="64" y="60" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold">{score}</text>
      <text x="64" y="77" textAnchor="middle" fill="#94a3b8" fontSize="11">{label}</text>
    </svg>
  );
}

const fmt = (n: number) =>
  '\u20B9' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(n));

export const Dashboard: React.FC = () => {
  const { dashboardData: d, loading, error } = useFinance();

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle className="h-5 w-5 mr-2" />{error}
      </div>
    );
  }

  const summary = d?.summary;
  const profile = d?.profile;

  const insights: string[] = [];
  if (summary) {
    if (summary.emi_burden_pct > 30)
      insights.push(`High EMI Burden — ${summary.emi_burden_pct.toFixed(1)}% of income goes to EMIs`);
    if (summary.emergency_fund_months < 3)
      insights.push(`Low Emergency Fund — only ${summary.emergency_fund_months} months covered`);
    if (summary.total_invested === 0)
      insights.push('Start Investing — you have no active investments');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back{profile?.name ? `, ${profile.name}` : ''}
        </h1>
        <p className="text-slate-400 text-sm mt-1">Here's your financial overview for this month</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Net Worth"      value={fmt(summary?.net_worth ?? 0)}          loading={loading} />
        <StatCard label="Total Debt"     value={fmt(summary?.total_debt ?? 0)}          loading={loading} />
        <StatCard label="Month Income"   value={fmt(summary?.total_income_month ?? 0)}  loading={loading} />
        <StatCard label="Month Expense"  value={fmt(summary?.total_expense_month ?? 0)} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-6 flex flex-col items-center justify-center">
          <HealthRing score={summary?.health_score ?? 0} loading={loading} />
          <p className="text-sm font-semibold text-slate-300 mt-2">Financial Health</p>
        </div>

        <div className="rounded-xl bg-slate-800 border border-slate-700 p-6 col-span-1 md:col-span-2">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Credit Profile</h3>
          <div className="grid grid-cols-2 gap-4">
            {(['CIBIL', 'Experian'] as const).map((bureau, idx) => {
              const score = idx === 0 ? d?.credit_scores?.cibil : d?.credit_scores?.experian;
              const bar = score ? ((score - 300) / 600) * 100 : 0;
              const col = !score ? 'bg-slate-700' : score >= 750 ? 'bg-green-500' : score >= 650 ? 'bg-yellow-500' : 'bg-red-500';
              return (
                <div key={bureau}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-slate-400">{bureau}</span>
                    <span className="text-sm font-bold text-white">{loading ? '—' : score ?? 'N/A'}</span>
                  </div>
                  <progress
                    value={bar}
                    max={100}
                    className={`h-2 w-full rounded-full overflow-hidden ${col}`}
                    aria-label={`${bureau} score progress`}
                    title={`${bureau} score progress`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              <span className="text-xs text-slate-400">EMI Burden</span>
              <span className="text-sm font-bold text-white">
                {loading ? '—' : `${(summary?.emi_burden_pct ?? 0).toFixed(1)}%`}
              </span>
            </div>
            <progress
              value={Math.min(summary?.emi_burden_pct ?? 0, 100)}
              max={100}
              className={`h-2 w-full rounded-full overflow-hidden ${(summary?.emi_burden_pct ?? 0) > 50 ? 'bg-red-500' : (summary?.emi_burden_pct ?? 0) > 30 ? 'bg-yellow-500' : 'bg-green-500'}`}
              aria-label="EMI burden progress"
              title="EMI burden progress"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-slate-800 border border-slate-700 p-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Net Worth Trend</h3>
        {loading ? (
          <div className="h-48 animate-pulse rounded-lg bg-slate-700" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={d?.net_worth_history ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="snapshot_date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => '\u20B9' + (v / 1000).toFixed(0) + 'k'} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [fmt(v), 'Net Worth']}
              />
              <Line type="monotone" dataKey="net_worth" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-400" /> AI Insights
          </h3>
          {loading ? (
            <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-700" />)}</div>
          ) : insights.length === 0 ? (
            <p className="text-sm text-green-400 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Great job! No critical alerts.
            </p>
          ) : (
            <ul className="space-y-2">
              {insights.map((msg, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-yellow-300 bg-yellow-500/10 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{msg}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl bg-slate-800 border border-slate-700 p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Recent Transactions</h3>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-700" />)}</div>
          ) : (d?.recent_transactions ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No transactions yet</p>
          ) : (
            <ul className="space-y-2">
              {(d?.recent_transactions ?? []).map(t => (
                <li key={t.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{t.category}</p>
                    <p className="text-xs text-slate-500">{t.date}</p>
                  </div>
                  <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(d?.wishlist_highlights ?? []).length > 0 && (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-6">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">High Priority Wishlist</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(d?.wishlist_highlights ?? []).map(w => (
              <div key={w.id} className="rounded-lg bg-slate-700/50 p-3">
                <p className="text-sm font-medium text-white truncate">{w.name}</p>
                <p className="text-xs text-indigo-400 font-semibold mt-1">{fmt(w.estimated_cost)}</p>
                {w.target_date && <p className="text-xs text-slate-500 mt-0.5">{w.target_date}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
