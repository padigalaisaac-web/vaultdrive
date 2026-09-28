import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './stores/appStore.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { MyFilesPage } from './pages/MyFilesPage.js';
import { RecentPage } from './pages/RecentPage.js';
import { FavoritesPage } from './pages/FavoritesPage.js';
import { OfflineFilesPage } from './pages/OfflineFilesPage.js';
import { TrashPage } from './pages/TrashPage.js';
import { SharedPage } from './pages/SharedPage.js';
import { SearchPage } from './pages/SearchPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { PublicSharePage } from './pages/PublicSharePage.js';
import { Spinner } from './components/ui/index.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoadingAuth } = useAppStore();

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Spinner size="lg" />
        <p className="text-sm text-slate-400 mt-3 font-medium">Opening VaultDrive…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  const { initAuth } = useAppStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public authentication routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/share/:token" element={<PublicSharePage />} />

        {/* Protected application routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="files" element={<MyFilesPage />} />
          <Route path="recent" element={<RecentPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="offline" element={<OfflineFilesPage />} />
          <Route path="trash" element={<TrashPage />} />
          <Route path="shared" element={<SharedPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
