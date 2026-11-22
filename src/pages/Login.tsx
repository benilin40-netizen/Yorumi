import React, { useEffect } from 'react';
import { AuthModal } from '../components/auth/AuthModal';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const { openAuthModal, user } = useAuth();

  useEffect(() => {
    if (!user) {
      openAuthModal('signin');
    }
  }, [user, openAuthModal]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0b14]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-[#0d0b14] to-[#0d0b14]" />
      {user ? (
        <div className="relative z-10 text-center space-y-2">
          <p className="text-white font-display font-bold text-xl">Signed in as {user.email}</p>
        </div>
      ) : (
        <div className="relative z-10 text-center">
          <button
            onClick={() => openAuthModal('signin')}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-bold shadow"
          >
            Sign In to YORUMI
          </button>
        </div>
      )}
      <AuthModal />
    </div>
  );
};
