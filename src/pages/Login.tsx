import React from 'react';
import { AuthModal } from '../components/auth/AuthModal';

export const Login: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0b14]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-[#0d0b14] to-[#0d0b14]"></div>
      <AuthModal isOpen={true} onClose={() => {}} initialMode="signin" />
    </div>
  );
};
