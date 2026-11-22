import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalMode,
    closeAuthModal,
    signInWithEmail,
    signUpWithEmail,
    supabaseConfigured,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>(authModalMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authModalOpen) {
      setMode(authModalMode);
      setError(null);
      setInfoMessage(null);
    }
  }, [authModalOpen, authModalMode]);

  if (!authModalOpen) return null;

  const validate = (): string | null => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return 'Please enter a valid email address.';
    }
    if (!password || password.length < 6) {
      return 'Password must be at least 6 characters long.';
    }
    if (mode === 'signup' && username.trim() && username.trim().length < 2) {
      return 'Username must be at least 2 characters.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const res = await signInWithEmail(email, password);
        if (!res.ok) {
          setError(res.error || 'Sign in failed. Check your email and password.');
        }
      } else {
        const res = await signUpWithEmail(email, password, username);
        if (!res.ok) {
          setError(res.error || 'Unable to create account.');
        } else if (res.needsConfirmation && res.message) {
          setInfoMessage(res.message);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={closeAuthModal}
    >
      <div
        className="w-full max-w-md bg-[#161321] border border-[#2a243a] rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#2a243a] pb-4">
          <div>
            <h2 className="font-display text-xl font-extrabold text-white tracking-tight">
              {mode === 'signin' ? 'Sign In to YORUMI' : 'Create YORUMI Account'}
            </h2>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              Sync your watch progress, My List, and player preferences.
            </p>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close authentication modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0d0b14] border border-[#2a243a] text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
              setInfoMessage(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              mode === 'signin'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
              setInfoMessage(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              mode === 'signup'
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {!supabaseConfigured && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Supabase auth is not configured in environment variables.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#fafafa]">
                Username (optional)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="yorumi_fan"
                  className="w-full bg-[#0d0b14] border border-[#2a243a] focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#a1a1aa]/60 outline-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#fafafa]">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="w-full bg-[#0d0b14] border border-[#2a243a] focus:border-purple-500/60 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#a1a1aa]/60 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#fafafa]">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Minimum 6 characters"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                className="w-full bg-[#0d0b14] border border-[#2a243a] focus:border-purple-500/60 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-[#a1a1aa]/60 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#a1a1aa] hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{infoMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !supabaseConfigured}
            className="w-full py-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-95 disabled:opacity-50 text-white text-xs font-bold shadow-[0_0_20px_rgba(168,85,247,0.35)] flex items-center justify-center gap-2 transition-all"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>
              {submitting
                ? mode === 'signin'
                  ? 'Signing In...'
                  : 'Creating Account...'
                : mode === 'signin'
                ? 'Sign In'
                : 'Create Account'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
