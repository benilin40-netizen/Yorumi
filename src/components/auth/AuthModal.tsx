import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  LogIn,
  UserPlus,
  KeyRound,
  RotateCcw,
  ShieldCheck,
  Check,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useUser } from '../../contexts/UserContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup' | 'forgot' | 'verify';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
}) => {
  const {
    loginManual,
    signUpManual,
    checkUsernameAvailable,
    sendPasswordResetAction,
    sendVerificationEmailAction,
    retryProfileSetup,
    authRecoveryUser,
    clearAuthRecovery,
    currentUser,
  } = useUser();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'verify'>(initialMode);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialMode]);

  // Sign In State
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up State
  const [signUpFullName, setSignUpFullName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpBio, setSignUpBio] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Real-time username validation state
  const [usernameStatus, setUsernameStatus] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({
    checking: false,
    available: null,
    message: '',
  });

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');

  // UI States
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string>('');

  // Password Strength Calculation
  const passwordStrength = useMemo(() => {
    const p = signUpPassword;
    if (!p) return { score: 0, label: '', color: 'bg-zinc-700' };

    let score = 0;
    if (p.length >= 6) score += 1;
    if (p.length >= 10) score += 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
    if (/[0-9]/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
    if (score === 3 || score === 4) return { score: 3, label: 'Good', color: 'bg-blue-500' };
    return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
  }, [signUpPassword]);

  // Username availability check with debounce
  useEffect(() => {
    const clean = signUpUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean) {
      setUsernameStatus({ checking: false, available: null, message: '' });
      return;
    }

    if (clean.length < 3) {
      setUsernameStatus({
        checking: false,
        available: false,
        message: 'Must be at least 3 characters.',
      });
      return;
    }

    setUsernameStatus({ checking: true, available: null, message: 'Checking availability...' });
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailable(clean);
        setUsernameStatus({
          checking: false,
          available: res.available,
          message: res.message,
        });
      } catch {
        setUsernameStatus({ checking: false, available: true, message: '' });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [signUpUsername, checkUsernameAvailable]);

  if (!isOpen) return null;

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!signInIdentifier.trim()) {
      setErrorMsg('Please enter your email address or username.');
      return;
    }
    if (!signInPassword) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginManual(signInIdentifier.trim(), signInPassword);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in. Verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanUsername = signUpUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 alphanumeric characters (letters, numbers, underscore).');
      return;
    }

    if (!signUpFullName.trim()) {
      setErrorMsg('Please provide your full name.');
      return;
    }

    if (!signUpEmail.trim() || !signUpEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (signUpPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (signUpPassword !== signUpConfirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter your password confirmation.');
      return;
    }

    if (!acceptedTerms) {
      setErrorMsg('Please review and accept the Yorumi Terms of Service to create your account.');
      return;
    }

    if (usernameStatus.available === false) {
      setErrorMsg('The selected username is already taken. Please choose another username.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signUpManual({
        username: cleanUsername,
        displayName: signUpFullName.trim(),
        email: signUpEmail.trim().toLowerCase(),
        password: signUpPassword,
        bio: signUpBio.trim(),
      });
      setRegisteredEmail(signUpEmail.trim().toLowerCase());
      setMode('verify');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create your account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordResetAction(cleanEmail);
      setSuccessMsg(`Password reset instructions have been dispatched to ${cleanEmail}. Check your inbox and spam folder.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send password reset email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await sendVerificationEmailAction();
      setSuccessMsg('A fresh verification link has been dispatched to your email address.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not resend verification email at this moment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryProfile = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await retryProfileSetup({
        username: signUpUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || undefined,
        displayName: signUpFullName.trim() || undefined,
        bio: signUpBio.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(`Profile retry failed: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md bg-[#161321] rounded-2xl border border-[#2a243a] shadow-2xl p-6 sm:p-7 space-y-4 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2a243a] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.4)]">
              <div className="w-full h-full bg-[#0d0b14] rounded-[10px] flex items-center justify-center">
                {mode === 'signin' ? (
                  <LogIn className="w-4 h-4 text-purple-400" />
                ) : mode === 'signup' ? (
                  <UserPlus className="w-4 h-4 text-purple-400" />
                ) : mode === 'forgot' ? (
                  <KeyRound className="w-4 h-4 text-purple-400" />
                ) : (
                  <Mail className="w-4 h-4 text-purple-400" />
                )}
              </div>
            </div>
            <div>
              <h2 className="font-display font-extrabold text-white text-base">
                {mode === 'signin'
                  ? 'Sign In to YORUMI'
                  : mode === 'signup'
                  ? 'Create Your Account'
                  : mode === 'forgot'
                  ? 'Reset Your Password'
                  : 'Verify Your Email'}
              </h2>
              <p className="text-[11px] text-[#a1a1aa] font-sans">
                {mode === 'signin'
                  ? 'Access your synchronized watchlist, scores, and history'
                  : mode === 'signup'
                  ? 'Join the YORUMI anime community'
                  : mode === 'forgot'
                  ? 'Enter your email to receive a password reset link'
                  : 'Complete verification to secure your account'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#a1a1aa] hover:text-white p-1 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle (Sign In / Sign Up) */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="flex rounded-full bg-[#0d0b14] p-1 border border-[#2a243a] text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-full transition-all ${
                mode === 'signin'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow font-bold'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-1.5 rounded-full transition-all ${
                mode === 'signup'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow font-bold'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Auth Recovery Banner */}
        {authRecoveryUser && (
          <div className="p-3.5 bg-purple-950/40 border border-purple-500/40 rounded-xl space-y-2 text-xs font-sans">
            <div className="flex items-center gap-2 text-purple-300 font-bold">
              <RotateCcw className="w-4 h-4 text-purple-400" />
              <span>Session Authenticated — Profile Recovery</span>
            </div>
            <p className="text-[11px] text-[#c4b5fd]">
              Your account is authenticated as <strong className="text-white">{authRecoveryUser.email}</strong>, but
              the user profile needs initialization.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleRetryProfile}
                disabled={isSubmitting}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg transition-all"
              >
                {isSubmitting ? 'Initializing Profile...' : 'Complete Profile Setup'}
              </button>
              <button
                type="button"
                onClick={clearAuthRecovery}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] rounded-lg transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* General Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-rose-950/50 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 font-sans animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span className="leading-tight">{errorMsg}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5 font-sans animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span className="leading-tight">{successMsg}</span>
          </div>
        )}

        {/* FORMS */}
        {mode === 'signin' ? (
          /* SIGN IN FORM */
          <form onSubmit={handleSignInSubmit} className="space-y-4 text-xs font-sans">
            <div className="space-y-1">
              <label className="block text-white font-bold">Email Address or Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="e.g. shinji@nerv.jp or shinji"
                  value={signInIdentifier}
                  onChange={(e) => setSignInIdentifier(e.target.value)}
                  className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl pl-9 pr-3.5 py-2.5 text-white placeholder-[#a1a1aa] outline-none focus:border-purple-500/60"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-white font-bold">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setForgotEmail(signInIdentifier.includes('@') ? signInIdentifier : '');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-[11px] text-purple-400 hover:text-purple-300 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-3" />
                <input
                  type={showSignInPassword ? 'text' : 'password'}
                  placeholder="Enter your password..."
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl pl-9 pr-10 py-2.5 text-white placeholder-[#a1a1aa] outline-none focus:border-purple-500/60"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSignInPassword(!showSignInPassword)}
                  className="absolute right-3 top-3 text-[#a1a1aa] hover:text-white"
                  aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Signing in...' : 'Sign In to Yorumi'}</span>
            </button>

            <p className="text-center text-[11px] text-[#a1a1aa] pt-1">
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-purple-400 hover:underline font-bold"
              >
                Create one now
              </button>
            </p>
          </form>
        ) : mode === 'signup' ? (
          /* SIGN UP FORM */
          <form onSubmit={handleSignUpSubmit} className="space-y-3 text-xs font-sans">
            {/* Full Name & Username */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-white font-bold">
                  Full Name <span className="text-purple-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="e.g. Shinji Ikari"
                    value={signUpFullName}
                    onChange={(e) => setSignUpFullName(e.target.value)}
                    className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl pl-8 pr-3 py-2 text-white placeholder-[#a1a1aa] outline-none focus:border-purple-500/60"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-white font-bold">
                    Username <span className="text-purple-400">*</span>
                  </label>
                  {usernameStatus.checking && (
                    <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 animate-spin" /> Checking
                    </span>
                  )}
                  {!usernameStatus.checking && usernameStatus.available === true && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" /> Available
                    </span>
                  )}
                  {!usernameStatus.checking && usernameStatus.available === false && (
                    <span className="text-[10px] text-rose-400">Unavailable</span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. shinji_eva"
                  value={signUpUsername}
                  onChange={(e) => setSignUpUsername(e.target.value)}
                  className={`w-full bg-[#0d0b14] border rounded-xl px-3 py-2 text-white placeholder-[#a1a1aa] outline-none font-mono ${
                    usernameStatus.available === true
                      ? 'border-emerald-500/50 focus:border-emerald-500'
                      : usernameStatus.available === false
                      ? 'border-rose-500/50 focus:border-rose-500'
                      : 'border-[#2a243a] focus:border-purple-500/60'
                  }`}
                  required
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label className="block text-white font-bold">
                Email Address <span className="text-purple-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-2.5" />
                <input
                  type="email"
                  placeholder="e.g. shinji@nerv.jp"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl pl-8 pr-3 py-2 text-white placeholder-[#a1a1aa] outline-none focus:border-purple-500/60 font-mono"
                  required
                />
              </div>
            </div>

            {/* Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-white font-bold">
                  Password <span className="text-purple-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-2.5" />
                  <input
                    type={showSignUpPassword ? 'text' : 'password'}
                    placeholder="Min. 6 chars"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl pl-8 pr-8 py-2 text-white placeholder-[#a1a1aa] outline-none focus:border-purple-500/60"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                    className="absolute right-2.5 top-2.5 text-[#a1a1aa] hover:text-white"
                    aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSignUpPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-white font-bold">
                  Confirm Password <span className="text-purple-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-3 top-2.5" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Re-type password"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    className={`w-full bg-[#0d0b14] border rounded-xl pl-8 pr-8 py-2 text-white placeholder-[#a1a1aa] outline-none ${
                      signUpConfirmPassword && signUpPassword === signUpConfirmPassword
                        ? 'border-emerald-500/50 focus:border-emerald-500'
                        : signUpConfirmPassword && signUpPassword !== signUpConfirmPassword
                        ? 'border-rose-500/50 focus:border-rose-500'
                        : 'border-[#2a243a] focus:border-purple-500/60'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-2.5 text-[#a1a1aa] hover:text-white"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Password Strength Meter */}
            {signUpPassword && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-zinc-400">Password strength:</span>
                  <span className="font-bold text-zinc-300">{passwordStrength.label}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex gap-1">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Optional Bio */}
            <div className="space-y-1">
              <label className="block text-white font-bold">Bio / Tagline (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Exploring cyberpunk and shonen series"
                value={signUpBio}
                onChange={(e) => setSignUpBio(e.target.value)}
                className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl px-3 py-1.5 text-white placeholder-[#a1a1aa] outline-none focus:border-purple-500/60"
              />
            </div>

            {/* Terms and Conditions Acceptance */}
            <label className="flex items-start gap-2.5 pt-1 text-[11px] text-zinc-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 rounded border-[#2a243a] text-purple-600 focus:ring-purple-500 accent-purple-600 shrink-0"
                required
              />
              <span>
                I agree to the <span className="text-purple-400 font-semibold hover:underline">Yorumi Terms of Service</span> and <span className="text-purple-400 font-semibold hover:underline">Privacy Policy</span>.
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !acceptedTerms}
              className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all active:scale-98 flex items-center justify-center gap-2 mt-2"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating Account...' : 'Create Yorumi Account'}</span>
            </button>

            <p className="text-center text-[11px] text-[#a1a1aa]">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-purple-400 hover:underline font-bold"
              >
                Sign in here
              </button>
            </p>
          </form>
        ) : mode === 'verify' ? (
          /* EMAIL VERIFICATION SCREEN */
          <div className="space-y-4 text-center font-sans py-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-500 p-0.5 mx-auto flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)]">
              <div className="w-full h-full bg-[#0d0b14] rounded-[14px] flex items-center justify-center">
                <Mail className="w-6 h-6 text-purple-400" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-display font-bold text-white text-base">Verify Your Email Address</h3>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                We have dispatched a verification link to <strong className="text-white">{registeredEmail || currentUser.email}</strong>.
              </p>
            </div>

            <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-xl text-[11px] text-purple-300 text-left space-y-1">
              <p className="font-semibold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Account Security
              </p>
              <p className="text-zinc-400 leading-relaxed">
                Clicking the verification link in your email confirms your account. You can explore Yorumi right now!
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-90 text-white font-bold text-xs rounded-full shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all"
              >
                Continue to Yorumi
              </button>

              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isSubmitting}
                className="w-full py-2 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs rounded-full border border-zinc-700/60 transition-all"
              >
                {isSubmitting ? 'Resending...' : 'Resend Verification Email'}
              </button>
            </div>
          </div>
        ) : (
          /* FORGOT PASSWORD FORM */
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-xs font-sans">
            <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
              Enter your registered email address and we will dispatch a password reset link to your inbox.
            </p>

            <div className="space-y-1">
              <label className="block text-white font-bold">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-3" />
                <input
                  type="email"
                  placeholder="e.g. shinji@nerv.jp"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-[#0d0b14] border border-[#2a243a] rounded-xl pl-9 pr-3.5 py-2.5 text-white placeholder-[#a1a1aa] outline-none focus:border-purple-500/60"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-[0_0_20px_rgba(168,85,247,0.35)] transition-all active:scale-98 flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Sending Link...' : 'Send Password Reset Link'}</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-purple-400 hover:underline text-[11px] font-bold"
              >
                &larr; Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
