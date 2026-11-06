'use client';

import { useSyncExternalStore, useCallback } from 'react';

// Suscripción reactiva para eventos de almacenamiento
function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('local-storage-sync', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('local-storage-sync', callback);
  };
}

/**
 * Hook seguro para SSR y React 19 que sincroniza con LocalStorage
 * sin generar errores de hidratación ni violar react-hooks/set-state-in-effect.
 */
export function useLocalStorageString(key: string, defaultValue: string): [string, (val: string) => void] {
  const getSnapshot = () => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? item : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const getServerSnapshot = () => defaultValue;

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (newVal: string) => {
      try {
        localStorage.setItem(key, newVal);
        window.dispatchEvent(new Event('local-storage-sync'));
      } catch {
        // Manejo silencioso de cuota o modo incógnito
      }
    },
    [key]
  );

  return [value, setValue];
}

export function useLocalStorageBoolean(key: string, defaultValue: boolean): [boolean, (val: boolean) => void] {
  const getSnapshot = () => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? item === 'true' : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const getServerSnapshot = () => defaultValue;

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (newVal: boolean) => {
      try {
        localStorage.setItem(key, String(newVal));
        window.dispatchEvent(new Event('local-storage-sync'));
      } catch {
        // Manejo silencioso de cuota o modo incógnito
      }
    },
    [key]
  );

  return [value, setValue];
}
