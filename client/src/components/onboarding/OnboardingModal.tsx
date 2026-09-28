import React, { useState } from 'react';
import { Cloud, HardDrive, WifiOff, CheckCircle2, ArrowRight } from 'lucide-react';
import { Modal, Button } from '../ui/index.js';
import { useAppStore } from '../../stores/appStore.js';

export const OnboardingModal: React.FC = () => {
  const { hasCompletedOnboarding, completeOnboarding } = useAppStore();
  const [step, setStep] = useState(1);

  if (hasCompletedOnboarding) return null;

  const screens = [
    {
      title: 'Welcome to VaultDrive',
      subtitle: 'Your personal offline-first cloud storage.',
      description: 'Experience seamless file storage that works online or offline with automatic synchronization.',
      icon: <Cloud className="w-16 h-16 text-brand-400" />,
      actionText: 'Get Started'
    },
    {
      title: 'Store Everything',
      subtitle: 'Documents, photos, videos, and more.',
      description: 'Upload files and folders effortlessly with drag & drop, instant search, and inline previews.',
      icon: <HardDrive className="w-16 h-16 text-purple-400" />,
      actionText: 'Continue'
    },
    {
      title: 'Available Offline',
      subtitle: 'Keep important files accessible without internet.',
      description: 'Mark files as "Available Offline" to download them to your device storage and access them anywhere.',
      icon: <WifiOff className="w-16 h-16 text-emerald-400" />,
      actionText: 'Continue'
    },
    {
      title: 'Ready',
      subtitle: 'Your personal storage is ready.',
      description: 'Start uploading files and organizing your folders with production-grade offline reliability.',
      icon: <CheckCircle2 className="w-16 h-16 text-emerald-400" />,
      actionText: 'Open VaultDrive'
    }
  ];

  const current = screens[step - 1];

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };

  return (
    <Modal isOpen={true} onClose={completeOnboarding} size="md">
      <div className="flex flex-col items-center text-center p-4">
        <div className="mb-6 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 shadow-lg">
          {current.icon}
        </div>

        <h2 className="text-xl font-bold text-slate-100 mb-1">{current.title}</h2>
        <p className="text-sm font-medium text-brand-400 mb-3">{current.subtitle}</p>
        <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
          {current.description}
        </p>

        {/* Stepper dots */}
        <div className="flex items-center gap-1.5 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? 'w-6 bg-brand-500' : 'w-2 bg-slate-700'
              }`}
            />
          ))}
        </div>

        <Button
          variant="primary"
          className="w-full justify-center py-2.5"
          onClick={handleNext}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          {current.actionText}
        </Button>
      </div>
    </Modal>
  );
};
