import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Navbar } from './Navbar.js';
import { MobileBottomNav } from './MobileBottomNav.js';
import { OfflineBanner } from '../OfflineBanner.js';
import { ConflictModal } from '../sync/ConflictModal.js';
import { OnboardingModal } from '../onboarding/OnboardingModal.js';

export const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <OfflineBanner />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pb-20 md:pb-8">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileBottomNav />
      <ConflictModal />
      <OnboardingModal />
    </div>
  );
};
