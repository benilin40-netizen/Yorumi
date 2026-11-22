import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Bookmark,
  Heart,
  History,
  Save,
  RefreshCw,
} from 'lucide-react';
import { useUser } from '../../contexts/UserContext';
import { getUserInitials } from '../../utils/userAvatar';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    watchlist,
    favorites,
    history,
    isEmailVerified,
    sendVerificationEmailAction,
    refreshVerificationStatusAction,
    updateMyProfile,
  } = useUser();

  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentUser.displayName || '');
      setBio(currentUser.bio || '');
      setAvatarUrl(currentUser.avatarUrl || '');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen || currentUser.id === 'guest') return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await updateMyProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim(),
      });
      setSuccessMsg('Profile updated and synced to your account.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckVerification = async () => {
    setVerifying(true);
    setError(null);
    try {
      const ok = await refreshVerificationStatusAction();
      if (ok) {
        setSuccessMsg('Your email address is verified.');
      } else {
        setError('Email is still unverified. Check your inbox or resend verification.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to check verification status.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg bg-[#161321] rounded-3xl border border-[#2a243a] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-[#2a243a] flex items-center justify-between bg-[#0d0b14]/50">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-11 h-11 rounded-2xl object-cover border border-purple-500/40"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm border border-purple-400/30">
                {getUserInitials(displayName || currentUser.username)}
              </div>
            )}
            <div>
              <h2 className="font-display font-bold text-white text-lg">Profile & Account</h2>
              <p className="text-xs text-[#a1a1aa] font-mono">@{currentUser.username}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#a1a1aa] hover:text-white p-2 rounded-xl bg-[#0d0b14] border border-[#2a243a]"
            aria-label="Close profile modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 font-sans">
          {/* Library Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-[#0d0b14] border border-[#2a243a] text-center">
              <Bookmark className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <div className="text-base font-bold text-white font-mono">{watchlist.length}</div>
              <div className="text-[11px] text-[#a1a1aa]">Watchlist</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#0d0b14] border border-[#2a243a] text-center">
              <Heart className="w-4 h-4 text-rose-400 mx-auto mb-1" />
              <div className="text-base font-bold text-white font-mono">{favorites.length}</div>
              <div className="text-[11px] text-[#a1a1aa]">Favorites</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#0d0b14] border border-[#2a243a] text-center">
              <History className="w-4 h-4 text-blue-400 mx-auto mb-1" />
              <div className="text-base font-bold text-white font-mono">{history.length}</div>
              <div className="text-[11px] text-[#a1a1aa]">History</div>
            </div>
          </div>

          {/* Email & Role Status */}
          <div className="p-3.5 rounded-2xl bg-[#0d0b14] border border-[#2a243a] space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#a1a1aa] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-purple-400" />
                {currentUser.email}
              </span>
              {isEmailVerified ? (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" /> Unverified
                </span>
              )}
            </div>

            {!isEmailVerified && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await sendVerificationEmailAction();
                      setSuccessMsg('Verification email dispatched. Check your inbox.');
                    } catch (err: any) {
                      setError(err?.message || 'Could not send verification email.');
                    }
                  }}
                  className="px-3 py-1 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 font-semibold hover:bg-purple-600/30"
                >
                  Resend Verification
                </button>
                <button
                  type="button"
                  onClick={handleCheckVerification}
                  disabled={verifying}
                  className="px-3 py-1 rounded-lg bg-[#161321] border border-[#2a243a] text-zinc-300 hover:text-white flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${verifying ? 'animate-spin' : ''}`} />
                  Refresh Status
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#fafafa] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-400" />
                Display Name
              </label>
              <input
                type="text"
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d0b14] border border-[#2a243a] focus:border-purple-500 text-xs text-white outline-none"
                placeholder="Your display name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#fafafa]">Avatar Image URL (optional)</label>
              <input
                type="url"
                maxLength={500}
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d0b14] border border-[#2a243a] focus:border-purple-500 text-xs text-white outline-none"
                placeholder="https://example.com/avatar.png"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#fafafa]">Bio</label>
              <textarea
                rows={3}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0d0b14] border border-[#2a243a] focus:border-purple-500 text-xs text-white outline-none resize-none"
                placeholder="Tell fellow anime fans what you watch..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full bg-[#0d0b14] border border-[#2a243a] text-xs font-semibold text-[#a1a1aa] hover:text-white"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 hover:opacity-90 disabled:opacity-50 text-xs font-bold text-white flex items-center gap-1.5 shadow"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
