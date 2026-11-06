'use client';

import React from 'react';
import { Menu, Youtube } from 'lucide-react';
import { TabType } from './Sidebar';

interface NavbarProps {
  activeTab?: TabType;
  onOpenMobileMenu?: () => void;
  onOpenSettings?: () => void;
  storageUsageFormatted?: string;
  theme?: string;
  onToggleTheme?: () => void;
  hasActiveVideo?: boolean;
  onResetDashboard?: () => void;
}

/**
 * Barra superior simplificada:
 * En pantallas de escritorio (md y superior), esta barra se oculta completamente (md:hidden)
 * para evitar redundancia con la barra lateral izquierda y maximizar el espacio útil.
 * En móviles se mantiene como barra compacta para desplegar el drawer de navegación.
 */
export function Navbar({ onOpenMobileMenu }: NavbarProps) {
  return (
    <header className="md:hidden sticky top-0 z-20 w-full border-b border-neutral-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85 transition-colors">
      <div className="flex h-14 items-center justify-between px-4">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="flex items-center justify-center h-9 w-9 rounded-xl border border-neutral-200 text-[#5B5B66] hover:text-[#121111] hover:bg-neutral-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Abrir menú lateral"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2848F0] dark:bg-rose-600 text-white shadow-2xs">
            <Youtube className="h-4 w-4 fill-current" />
          </div>
          <span className="text-xs font-bold text-[#121111] dark:text-white font-heading">
            YouTube Content Toolkit
          </span>
        </div>

        <div className="w-9" />
      </div>
    </header>
  );
}
