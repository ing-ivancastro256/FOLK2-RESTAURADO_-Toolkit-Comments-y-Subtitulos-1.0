'use client';

import React, { useState } from 'react';
import {
  Youtube,
  Search,
  Flame,
  Sparkles,
  History,
  Sun,
  Moon,
  Settings,
  X,
  RotateCcw,
  Users,
  Star,
  Download,
  LogOut,
  User,
  Check,
  CheckCircle2,
  ListMusic,
  Terminal,
  Layers,
} from 'lucide-react';
import { YouTubeVideoMetadata } from '@/lib/types';
import { formatDuration } from '@/lib/youtube';

export type TabType =
  | 'search'
  | 'shorts'
  | 'channel'
  | 'downloads'
  | 'playlists'
  | 'favorites'
  | 'history'
  | 'repurpose'
  | 'outputs'
  | 'prompts';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  metadata: YouTubeVideoMetadata | null;
  savedVideosCount: number;
  storageUsageFormatted?: string;
  theme: string;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onResetDashboard: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  metadata,
  savedVideosCount,
  storageUsageFormatted,
  theme,
  onToggleTheme,
  onOpenSettings,
  onResetDashboard,
  isOpenMobile,
  onCloseMobile,
}: SidebarProps) {
  const isDark = theme === 'dark';
  const [logoutToast, setLogoutToast] = useState<string | null>(null);

  // Orden estricto según la petición del usuario:
  // 1. Buscador, 2. Shorts, 3. Canales, 4. Descargas, 5. Listas de Reproducción, 6. Favoritos, 7. Historial, 8. Repurposing con IA al final
  const navItems = [
    {
      id: 'search' as TabType,
      label: 'Buscador de Videos',
      shortLabel: 'Buscador',
      icon: Search,
      badge: 'Con Filtros',
      badgeColor: 'bg-neutral-100 text-[#5B5B66] dark:bg-slate-800 dark:text-slate-300',
    },
    {
      id: 'shorts' as TabType,
      label: 'YouTube Shorts',
      shortLabel: 'Shorts',
      icon: Flame,
      badge: '< 60 seg',
      badgeColor: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    },
    {
      id: 'channel' as TabType,
      label: 'Buscar por Usuario / Canal',
      shortLabel: 'Canales',
      icon: Users,
      badge: '@handle',
      badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
    },
    {
      id: 'downloads' as TabType,
      label: 'Centro de Descargas',
      shortLabel: 'Descargas',
      icon: Download,
      badge: 'Hub Unificado',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    },
    {
      id: 'playlists' as TabType,
      label: 'Listas de Reproducción',
      shortLabel: 'Playlists',
      icon: ListMusic,
      badge: 'Continuo',
      badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
    },
    {
      id: 'favorites' as TabType,
      label: 'Favoritos',
      shortLabel: 'Favoritos',
      icon: Star,
      badge: 'Canales y Videos',
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    },
    {
      id: 'history' as TabType,
      label: 'Historial',
      shortLabel: 'Historial',
      icon: History,
      badge: savedVideosCount > 0 ? `${savedVideosCount}` : undefined,
      badgeColor: 'bg-neutral-200 text-[#121111] dark:bg-slate-700 dark:text-slate-200',
    },
    {
      id: 'repurpose' as TabType,
      label: 'Repurposing con IA',
      shortLabel: 'Repurposing IA',
      icon: Sparkles,
      badge: 'IA Gemini',
      badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    },
    {
      id: 'outputs' as TabType,
      label: 'Salidas Prompt',
      shortLabel: 'Salidas IA',
      icon: Layers,
      badge: 'Historial',
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    },
    {
      id: 'prompts' as TabType,
      label: 'Gestión de Prompts',
      shortLabel: 'Prompts IA',
      icon: Terminal,
      badge: 'Almacén',
      badgeColor: 'bg-blue-100 text-[#2848F0] dark:bg-blue-950/50 dark:text-blue-300',
    },
  ];

  const handleItemClick = (tab: TabType) => {
    onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };

  const handleSimulateLogout = () => {
    setLogoutToast('Sesión simulada lista para conectar con Firebase Authentication');
    setTimeout(() => setLogoutToast(null), 3500);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 select-none">
      {/* 1. Header con Branding */}
      <div className="p-4 sm:p-5 border-b border-neutral-200/80 dark:border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2848F0] dark:bg-rose-600 text-white shadow-sm transition-colors">
            <Youtube className="h-5 w-5 fill-current" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#121111] dark:text-white font-heading leading-tight">
              YouTube Content
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-semibold text-[#2848F0] dark:text-rose-400">
                Toolkit Suite
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-neutral-100 dark:bg-slate-800 font-mono text-[#5B5B66] dark:text-slate-400">
                PRO
              </span>
            </div>
          </div>
        </div>

        {/* Botón de cierre para versión móvil */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg text-[#5B5B66] hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-900 cursor-pointer"
            aria-label="Cerrar barra lateral"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* 2. Lista de Herramientas en Fila Vertical */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold tracking-wider text-[#5B5B66]/70 dark:text-slate-400 uppercase">
          Navegación del Toolkit
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                isActive
                  ? 'bg-[#EEF1F8] text-[#2848F0] dark:bg-slate-800/90 dark:text-white shadow-2xs'
                  : 'text-[#5B5B66] hover:text-[#121111] hover:bg-neutral-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive
                      ? 'text-[#2848F0] dark:text-rose-400'
                      : 'text-[#5B5B66] dark:text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 font-medium ${item.badgeColor}`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* 3. Tarjeta de Video en Curso (si hay video activo en memoria) */}
        {metadata && (
          <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-slate-800/80">
            <div className="px-3 pb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-wider text-[#5B5B66]/70 dark:text-slate-400 uppercase">
                Video en curso
              </span>
              <button
                onClick={onResetDashboard}
                className="text-[10px] text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                title="Cerrar video actual"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>Limpiar</span>
              </button>
            </div>

            <div className="p-2.5 rounded-xl border border-neutral-200/80 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/40 space-y-2">
              <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black">
                <img
                  src={metadata.thumbnails.hq.url}
                  alt={metadata.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.2 rounded text-[9px] font-mono text-white">
                  {metadata.duration || formatDuration(metadata.durationSeconds || 0)}
                </span>
              </div>

              <div className="space-y-0.5">
                <h4
                  className="text-xs font-bold text-[#121111] dark:text-slate-200 line-clamp-1"
                  title={metadata.title}
                >
                  {metadata.title}
                </h4>
                <p className="text-[10px] text-[#5B5B66] dark:text-slate-400 truncate">
                  {metadata.channelTitle}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() => handleItemClick('downloads')}
                  className="w-full flex items-center justify-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40 py-1 text-[10px] font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <Download className="h-3 w-3" />
                  <span>Descargas</span>
                </button>
                <button
                  onClick={() => handleItemClick('repurpose')}
                  className="w-full flex items-center justify-center gap-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/40 py-1 text-[10px] font-semibold hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Guiones IA</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Footer de la Barra Lateral: Base de Datos, Tema, Ajustes y Cuenta de Usuario */}
      <div className="p-3 border-t border-neutral-200/80 dark:border-slate-800/80 space-y-2.5 bg-neutral-50/50 dark:bg-slate-900/40">
        <div className="flex items-center justify-between text-[11px] text-[#5B5B66] dark:text-slate-400 px-1 font-mono">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Almacenamiento:</span>
          </span>
          <span className="font-semibold text-[#121111] dark:text-slate-300">
            {storageUsageFormatted || 'IndexedDB'}
          </span>
        </div>

        {/* Fila: Modo Claro/Oscuro y Ajustes */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onToggleTheme}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white py-2 px-2 text-xs font-semibold text-[#121111] hover:bg-neutral-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-all shadow-2xs cursor-pointer"
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span>Claro</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-[#2848F0]" />
                <span>Oscuro</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white py-2 px-2 text-xs font-semibold text-[#121111] hover:bg-neutral-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors shadow-2xs cursor-pointer"
            title="Ajustes de API y preferencias"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Ajustes</span>
          </button>
        </div>

        {/* 5. Maquetita de Cuenta de Usuario (Debajo de Ajustes, lista para Firebase Auth) */}
        <div className="pt-2 border-t border-neutral-200/60 dark:border-slate-800/60">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-neutral-200/80 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Círculo de la foto/avatar con indicador de estado activo */}
              <div className="relative h-8 w-8 rounded-full bg-gradient-to-tr from-[#2848F0] to-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                <span>IC</span>
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-white dark:ring-slate-900" />
              </div>

              {/* Nombre de usuario y estado */}
              <div className="min-w-0">
                <span className="text-xs font-bold text-[#121111] dark:text-slate-100 block truncate leading-tight">
                  Iván Castro
                </span>
                <span className="text-[10px] text-[#5B5B66] dark:text-slate-400 truncate block">
                  Creador · Plan Pro
                </span>
              </div>
            </div>

            {/* Botón de Cerrar Sesión */}
            <button
              type="button"
              onClick={handleSimulateLogout}
              className="flex items-center justify-center h-7 w-7 rounded-lg text-[#5B5B66] hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors shrink-0 cursor-pointer"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Feedback de acción para cerrar sesión */}
          {logoutToast && (
            <div className="mt-1.5 p-2 rounded-lg bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 text-[10px] text-[#2848F0] dark:text-rose-400 font-medium flex items-center gap-1.5 animate-in fade-in duration-150">
              <Check className="h-3 w-3 shrink-0 text-emerald-600" />
              <span>{logoutToast}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Barra lateral fija en Desktop (md y superior) */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r border-neutral-200/80 dark:border-slate-800/80 h-screen sticky top-0 z-30 transition-colors">
        {sidebarContent}
      </aside>

      {/* Drawer desplegable en Móvil */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
