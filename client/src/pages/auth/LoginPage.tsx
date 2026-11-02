import React, { useState } from 'react';
import { LogIn, KeyRound, User, AlertCircle, Shield } from 'lucide-react';
import { Logo } from '../../components/common/Logo.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [workerId, setWorkerId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId.trim() || !pin.trim()) {
      setError('Please enter your Worker ID and Password/PIN');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(workerId.trim(), pin.trim());
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Shree Swami Samarth Background - fitted in frame */}
      <div
        className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center p-4 sm:p-8 select-none"
        aria-hidden="true"
      >
        <img
          src="/swami-samarth-bg.jpg"
          alt="Shree Swami Samarth"
          className="max-h-[90vh] max-w-[90vw] sm:max-w-[70vw] lg:max-w-[50vw] object-contain object-center opacity-[0.18] filter contrast-105"
        />
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <Logo size="lg" showSubtitle={false} />
        </div>
        <h2 className="text-center text-xl sm:text-2xl font-extrabold text-navy-950 tracking-tight">
          Smart Attendance Portal
        </h2>
        <p className="mt-1 text-center text-xs sm:text-sm text-slate-600">
          Factory Workers Check-In & Owner Administration
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl shadow-slate-200/80 rounded-2xl border border-slate-200/80">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="workerId" className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                User ID / Worker ID
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="workerId"
                  type="text"
                  autoComplete="off"
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value.toUpperCase())}
                  placeholder="Enter User ID (Owner) or Worker ID"
                  required
                  className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono text-sm tracking-wide"
                />
              </div>
            </div>

            <div>
              <label htmlFor="pin" className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                Password / PIN
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="pin"
                  type="password"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter Password / PIN"
                  required
                  className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm tracking-widest"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm sm:text-base font-bold text-white bg-gradient-to-r from-navy-900 to-teal-800 hover:from-navy-800 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-all tap-active"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          Shree Swami Samarth Fabric • Textile Manufacturing Plant • Timezone: Asia/Kolkata
        </div>
      </div>
    </div>
  );
};
