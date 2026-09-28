let deferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  window.dispatchEvent(new CustomEvent('vaultdrive:installable'));
});

export const isPWAInstallable = (): boolean => {
  return deferredPrompt !== null;
};

export const promptPWAInstall = async (): Promise<boolean> => {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choiceResult = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choiceResult.outcome === 'accepted';
};
