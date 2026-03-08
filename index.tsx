import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/react';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

const MissingKeyScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200 font-sans">
    <div className="max-w-md text-center p-8">
      <h1 className="text-2xl font-bold mb-3 text-red-400">Configuration Required</h1>
      <p className="mb-4 leading-relaxed text-slate-400">
        The <code className="bg-slate-800 px-1.5 py-0.5 rounded">VITE_CLERK_PUBLISHABLE_KEY</code> environment variable is not set.
      </p>
      <p className="leading-relaxed text-slate-400">
        Create a <code className="bg-slate-800 px-1.5 py-0.5 rounded">.env.local</code> file in the project root with:
      </p>
      <pre className="bg-slate-800 p-4 rounded-lg text-left mt-3 text-xs overflow-x-auto">
{`VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
      </pre>
      <p className="mt-4 text-xs text-slate-500">
        See CLERK_SETUP.md for full instructions. Restart the dev server after creating the file.
      </p>
    </div>
  </div>
);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {CLERK_KEY ? (
      <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    ) : (
      <MissingKeyScreen />
    )}
  </React.StrictMode>
);
