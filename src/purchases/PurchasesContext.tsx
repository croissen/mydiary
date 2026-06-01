import React, { createContext, useContext, useMemo } from 'react';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

export interface PurchasesState {
  isPro: boolean;
  isTrialing: boolean;
  trialDaysLeft: number;
  isLoading: boolean;
  currentOffering: PurchasesOffering | null;
  purchase: (pkg: PurchasesPackage) => Promise<void>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesState | null>(null);

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<PurchasesState>(() => ({
    isPro: true,
    isTrialing: false,
    trialDaysLeft: 0,
    isLoading: false,
    currentOffering: null,
    purchase: async () => {},
    restore: async () => false,
    refresh: async () => {},
  }), []);

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

export function usePro(): PurchasesState {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error('usePro must be used within PurchasesProvider');
  return ctx;
}
