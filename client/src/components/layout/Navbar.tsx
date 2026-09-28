import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Menu, LogOut, Sun, Moon, User as UserIcon } from 'lucide-react';
import { useAppStore } from '../../stores/appStore.js';
import { UploadManager } from '../upload/UploadManager.js';

export const Navbar: React.FC = () => {
  const { user, logout, toggleSidebar, isMobile, theme, setTheme } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {isMobile && (
          <button
            onClick={toggleSidebar}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Global Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-48 sm:w-80 md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search files and folders…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
          />
        </form>
      </div>

      <div className="flex items-center gap-3">
        {/* Upload Button */}
        <UploadManager onUploadsComplete={() => window.dispatchEvent(new CustomEvent('vaultdrive:refresh'))} />

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Profile Avatar / Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 p-1 pl-2 rounded-xl border border-slate-700/80 hover:bg-slate-800 transition-all"
            aria-label="User account"
          >
            <span className="text-xs font-medium text-slate-200 hidden sm:inline max-w-[100px] truncate">
              {user?.name || 'Account'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white text-xs font-semibold">
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
            </div>
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 card shadow-2xl border-slate-700 p-2 z-50 animate-fade-in text-xs">
                <div className="px-3 py-2 border-b border-slate-700/70 mb-1">
                  <p className="font-semibold text-slate-100 truncate">{user?.name}</p>
                  <p className="text-slate-400 text-[11px] truncate mt-0.5">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full text-left px-3 py-2 text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Settings & Storage
                </button>
                <div className="my-1 border-t border-slate-700" />
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-950/30 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
