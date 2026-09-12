import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Loader2, Zap, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (role: string) => {
    const creds: Record<string, { email: string; password: string }> = {
      admin: { email: 'admin@velozity.com', password: 'Password123!' },
      pm1: { email: 'pm1@velozity.com', password: 'Password123!' },
      pm2: { email: 'pm2@velozity.com', password: 'Password123!' },
      dev1: { email: 'dev1@velozity.com', password: 'Password123!' },
    };
    setEmail(creds[role].email);
    setPassword(creds[role].password);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden px-4">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-40 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-5 glow-indigo shadow-lg shadow-indigo-500/30">
            <Zap className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Velozity Dashboard</h1>
          <p className="text-slate-400 mt-2 text-sm">Real-Time Project Management Platform</p>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to your account</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@velozity.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Quick-login demo buttons */}
          <div className="mt-6 pt-6 border-t border-slate-700/60">
            <p className="text-xs text-slate-500 mb-3 text-center uppercase tracking-wider font-medium">
              Quick Demo Access
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'admin', label: 'Admin', color: 'bg-violet-600/20 border-violet-500/30 text-violet-300 hover:bg-violet-600/30' },
                { key: 'pm1', label: 'PM (Marcus)', color: 'bg-blue-600/20 border-blue-500/30 text-blue-300 hover:bg-blue-600/30' },
                { key: 'pm2', label: 'PM (Sarah)', color: 'bg-cyan-600/20 border-cyan-500/30 text-cyan-300 hover:bg-cyan-600/30' },
                { key: 'dev1', label: 'Developer', color: 'bg-emerald-600/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30' },
              ].map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => quickLogin(btn.key)}
                  className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-150 ${btn.color}`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2 text-center">
              Password for all: <span className="text-slate-500 font-mono">Password123!</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
