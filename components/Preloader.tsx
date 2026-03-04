import React from 'react';

export const Preloader: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 opacity-80 blur-sm" />
          <div className="relative h-16 w-16 rounded-2xl border border-slate-700 bg-slate-900/80 shimmer" />
        </div>
        <p className="rise-up text-sm font-semibold tracking-wide text-slate-300">Loading FinanceBuddy</p>
      </div>
    </div>
  );
};
