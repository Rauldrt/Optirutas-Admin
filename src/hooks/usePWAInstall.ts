import { useState, useEffect, useCallback } from 'react';

// Module-level variable to capture beforeinstallprompt as soon as script evaluates,
// ensuring it is never missed before React components mount.
let globalDeferredPrompt: any = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e;
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(globalDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    // 1. Detect if running standalone (already installed as PWA)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsInstalled(isStandalone);

    // 2. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isAppleDevice);

    if (globalDeferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      globalDeferredPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      setShowInstallGuide(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    // On iOS Safari, native beforeinstallprompt does not exist; show manual guide
    if (isIOS) {
      setShowInstallGuide(true);
      return;
    }

    const promptEvent = deferredPrompt || globalDeferredPrompt;
    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult?.outcome === 'accepted') {
          setIsInstalled(true);
        }
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        return;
      } catch (err) {
        console.warn('PWA install prompt error:', err);
      }
    }

    // Fallback: if browser hasn't fired or blocks beforeinstallprompt, show the guide
    setShowInstallGuide(true);
  }, [deferredPrompt, isIOS]);

  return {
    isInstallable: !isInstalled,
    isInstalled,
    isIOS,
    showIOSPrompt: showInstallGuide,
    setShowIOSPrompt: setShowInstallGuide,
    showInstallGuide,
    setShowInstallGuide,
    installApp
  };
}
