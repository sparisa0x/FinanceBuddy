import React from 'react';
import { ArrowRight, BarChart3, Bot, ShieldCheck, Sparkles } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

const features = [
  {
    title: 'Secure Session Intelligence',
    description: 'OTP-gated access, admin approvals, and stable long-lived session handling for uninterrupted use.',
    icon: ShieldCheck,
  },
  {
    title: 'Unified Money Command Center',
    description: 'Track income, expenses, debt, investment growth, and wishlist goals in one dashboard.',
    icon: BarChart3,
  },
  {
    title: 'AI-first Finance Workflow',
    description: 'Built for data-driven decisions with practical insights and smart categorization-ready architecture.',
    icon: Bot,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onSignIn }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600" />
            <span className="text-lg font-bold">FinanceBuddy</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onSignIn} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-900">
              Sign In
            </button>
            <button onClick={onGetStarted} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Get Access
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-12 pt-16 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <p className="rise-up text-sm font-semibold uppercase tracking-widest text-indigo-400">Home</p>
          <h1 className="rise-up text-4xl font-extrabold leading-tight sm:text-5xl">
            Premium Finance OS for
            <span className="block bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              modern decision makers
            </span>
          </h1>
          <p className="rise-up text-slate-300">
            FinanceBuddy gives your team a secure, high-performance personal finance command center with OTP-secured login, admin-governed approvals, and seamless analytics workflows.
          </p>
          <div className="rise-up flex flex-wrap gap-3">
            <button onClick={onGetStarted} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 font-semibold hover:bg-indigo-700">
              Launch Dashboard Access <ArrowRight className="h-4 w-4" />
            </button>
            <button onClick={onSignIn} className="rounded-lg border border-slate-700 px-5 py-3 font-semibold text-slate-200 hover:bg-slate-900">
              Existing User Sign In
            </button>
          </div>
        </div>

        <div className="rise-up rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-400">Live Dashboard Preview</p>
            <Sparkles className="h-4 w-4 text-indigo-400" />
          </div>
          <img
            src="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80"
            alt="Finance dashboard preview"
            className="h-72 w-full rounded-xl object-cover"
          />
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 py-14">
        <h2 className="text-2xl font-bold">Product Features</h2>
        <p className="mt-2 text-slate-400">Built with production-grade security and financial workflow depth.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 transition hover:border-slate-700">
                <Icon className="h-6 w-6 text-indigo-400" />
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="about" className="mx-auto max-w-7xl px-6 py-14">
        <h2 className="text-2xl font-bold">About</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-lg font-semibold">Sriram Parisa</p>
            <p className="mt-1 text-sm text-indigo-400">Project Owner</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-lg font-semibold">Revanth Chary (pumpkin)</p>
            <p className="mt-1 text-sm text-indigo-400">Vibe Coder</p>
          </div>
        </div>
      </section>

      <section id="reach-out" className="mx-auto max-w-7xl px-6 pb-16 pt-6">
        <div className="rounded-2xl border border-indigo-700/40 bg-indigo-900/20 p-8">
          <h2 className="text-2xl font-bold">Reach Out for Enquiry / Access</h2>
          <p className="mt-2 text-slate-300">Need early access or enterprise onboarding support? Connect with us to enable your account and setup.</p>
          <button onClick={onGetStarted} className="mt-5 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold hover:bg-indigo-700">
            Request Access
          </button>
        </div>
      </section>
    </div>
  );
};
