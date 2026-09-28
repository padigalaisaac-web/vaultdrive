import React from 'react';
import { NavLink } from 'react-router-dom';
import { HardDrive, WifiOff, Search, Settings, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '../../stores/appStore.js';

export const MobileBottomNav: React.FC = () => {
  const { isMobile } = useAppStore();

  if (!isMobile) return null;

  const items = [
    { to: '/files', icon: HardDrive, label: 'Files' },
    { to: '/offline', icon: WifiOff, label: 'Offline' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/trash', icon: Trash2, label: 'Trash' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-40 flex items-center justify-around h-14 px-2">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            clsx(
              'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors flex-1 py-1',
              isActive ? 'text-brand-400' : 'text-slate-400 hover:text-slate-200'
            )
          }
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};
