'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Star,
  Trash2,
  Download,
  Sparkles,
  Play,
  HardDrive,
  AlertTriangle,
} from 'lucide-react';
import {
  YouTubeVideoMetadata,
  GeneratedContentItem,
  StorageEstimateInfo,
  YouTubeSearchResultItem,
} from '@/lib/types';
import { formatCompactNumber, formatDuration } from '@/lib/youtube';

interface LibraryTabProps {
  videos: YouTubeVideoMetadata[];
  aiDrafts: GeneratedContentItem[];
  storageInfo: StorageEstimateInfo;
  onSelectVideo: (videoId: string) => void;
  onOpenVideoWatch?: (video: YouTubeSearchResultItem) => void;
  onDeleteVideo: (videoId: string) => Promise<void>;
  onDeleteDraft: (id: number) => Promise<void>;
  onToggleFavorite: (videoId: string) => Promise<void>;
  onClearAllData: () => Promise<void>;
}

export function LibraryTab({
  videos,
  aiDrafts,
  storageInfo,
  onSelectVideo,
  onOpenVideoWatch,
  onDeleteVideo,
  onDeleteDraft,
  onToggleFavorite,
  onClearAllData,
}: LibraryTabProps) {
  const [filterType, setFilterType] = useState<'all' | 'favorites' | 'videos' | 'ai'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredVideos = useMemo(() => {
    let result = videos;
    if (filterType === 'favorites') {
      result = result.filter((v) => v.isFavorite);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.channelTitle.toLowerCase().includes(q) ||
          v.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [videos, filterType, searchQuery]);

  const filteredDrafts = useMemo(() => {
    let result = aiDrafts;
    if (filterType === 'favorites') {
      result = [];
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q) ||
          d.videoTitle.toLowerCase().includes(q)
      );
    }
    return result;
  }, [aiDrafts, filterType, searchQuery]);

  const handleExportJson = () => {
    const backupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      videos,
      aiDrafts,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `youtube-toolkit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenWatch = (video: YouTubeVideoMetadata) => {
    if (onOpenVideoWatch) {
      onOpenVideoWatch({
        id: video.videoId,
        title: video.title,
        description: video.description || '',
        channelTitle: video.channelTitle || '',
        publishedAt: video.publishedAt || 'Reciente',
        thumbnailUrl:
          video.thumbnails?.hq?.url ||
          video.thumbnails?.mq?.url ||
          video.thumbnails?.default?.url ||
          `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
        durationText: video.duration || (video.durationSeconds ? formatDuration(video.durationSeconds) : undefined),
        viewCountText: video.viewCount,
      });
    } else {
      onSelectVideo(video.videoId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y estadísticas de almacenamiento */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200/80 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#121111] dark:text-slate-100 font-heading">Historial de Actividad y Análisis</h2>
          <p className="text-xs text-[#5B5B66] dark:text-slate-400 mt-0.5">
            Registro de tus videos analizados y borradores de contenido generados localmente en tu navegador.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportJson}
            disabled={videos.length === 0 && aiDrafts.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-[#121111] dark:text-slate-200 hover:bg-[#FAFAFA] dark:hover:bg-slate-800 transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar Backup (JSON)</span>
          </button>

          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={videos.length === 0 && aiDrafts.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100/80 dark:hover:bg-rose-900/40 transition-colors shadow-2xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Vaciar datos</span>
          </button>
        </div>
      </div>

      {/* Monitor de cuota de almacenamiento */}
      <div className="rounded-2xl border border-neutral-200/90 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/50 p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#121111] dark:text-slate-300 font-semibold font-heading">
            <HardDrive className="h-4 w-4 text-[#2848F0] dark:text-slate-400" />
            <span>Cuota de Almacenamiento Local del Navegador</span>
          </div>
          <div className="font-mono text-[#5B5B66] dark:text-slate-400 tabular-nums">
            Uso: <span className="text-[#121111] dark:text-slate-200 font-bold">{storageInfo.usageFormatted}</span> / {storageInfo.quotaFormatted} ({storageInfo.percentageUsed}%)
          </div>
        </div>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              storageInfo.percentageUsed > 80 ? 'bg-amber-500' : 'bg-[#2848F0] dark:bg-rose-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(2, storageInfo.percentageUsed))}%` }}
          />
        </div>
      </div>

      {/* Barra de filtros y búsqueda */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#F5F5F5] dark:bg-slate-900 p-1 rounded-xl border border-neutral-200/60 dark:border-slate-800 shadow-2xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'all'
                ? 'bg-white text-[#121111] shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Todos ({videos.length + aiDrafts.length})
          </button>
          <button
            onClick={() => setFilterType('favorites')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'favorites'
                ? 'bg-white text-[#121111] shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Favoritos ({videos.filter((v) => v.isFavorite).length})
          </button>
          <button
            onClick={() => setFilterType('videos')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'videos'
                ? 'bg-white text-[#121111] shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Videos ({videos.length})
          </button>
          <button
            onClick={() => setFilterType('ai')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filterType === 'ai'
                ? 'bg-white text-[#121111] shadow-xs dark:bg-slate-800 dark:text-white'
                : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Borradores IA ({aiDrafts.length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#5B5B66] dark:text-slate-500">
            <Search className="h-3.5 w-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en la biblioteca..."
            className="w-full rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900/90 py-2 pl-9 pr-3 text-xs text-[#121111] dark:text-slate-200 placeholder-[#5B5B66]/70 focus:border-[#2848F0] dark:focus:border-rose-500 focus:outline-none shadow-xs"
          />
        </div>
      </div>

      {/* Listado de Videos guardados */}
      {(filterType === 'all' || filterType === 'favorites' || filterType === 'videos') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-[#121111] dark:text-slate-300 font-heading">
            <span>Videos Analizados ({filteredVideos.length})</span>
          </div>

          {filteredVideos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredVideos.map((video) => (
                <div
                  key={video.videoId}
                  className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs transition-all hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                >
                  <div
                    onClick={() => handleOpenWatch(video)}
                    className="relative aspect-video w-full bg-neutral-900 cursor-pointer overflow-hidden group/thumb"
                  >
                    <img
                      src={video.thumbnails?.hq?.url || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
                      alt={video.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#121111] shadow-lg">
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(video.videoId);
                      }}
                      className="absolute top-2.5 right-2.5 rounded-lg bg-black/70 p-1.5 text-white hover:text-amber-400 transition-colors shadow-xs z-10"
                      title={video.isFavorite ? 'Quitar de favoritos' : 'Marcar favorito'}
                    >
                      <Star className={`h-4 w-4 ${video.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                    <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/80 px-2 py-0.5 font-mono text-[10px] text-white tabular-nums">
                      {video.duration || (video.durationSeconds ? formatDuration(video.durationSeconds) : 'N/A')}
                    </span>
                  </div>

                  <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                    <div className="space-y-1">
                      <h4
                        onClick={() => handleOpenWatch(video)}
                        className="text-xs font-bold text-[#121111] dark:text-slate-100 line-clamp-2 leading-snug font-heading cursor-pointer hover:text-[#2848F0] dark:hover:text-rose-400 transition-colors"
                        title={video.title}
                      >
                        {video.title}
                      </h4>
                      <p className="text-[11px] text-[#5B5B66] dark:text-slate-400">{video.channelTitle}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-slate-800/80">
                      <button
                        onClick={() => handleOpenWatch(video)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#2848F0] dark:text-rose-400 hover:underline transition-colors cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Reproducir video</span>
                      </button>

                      <button
                        onClick={() => onDeleteVideo(video.videoId)}
                        className="text-[#5B5B66] hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 transition-colors p-1 cursor-pointer"
                        title="Eliminar del historial"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-[#5B5B66] dark:text-slate-500 rounded-2xl border border-dashed border-neutral-200 dark:border-slate-800/80 bg-[#FAFAFA] dark:bg-transparent">
              No hay videos guardados que coincidan con el filtro actual.
            </div>
          )}
        </div>
      )}

      {/* Listado de Borradores IA */}
      {(filterType === 'all' || filterType === 'ai') && (
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#121111] dark:text-slate-300 font-heading">
            <span>Contenido Generado con IA ({filteredDrafts.length})</span>
          </div>

          {filteredDrafts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-2xl border border-neutral-200/90 bg-white p-4.5 space-y-3.5 shadow-xs transition-all dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#2848F0] dark:text-rose-400 font-bold uppercase tracking-wider font-heading">
                        <Sparkles className="h-3 w-3" />
                        <span>{draft.type.replace('_', ' ')}</span>
                      </div>
                      <h4 className="text-xs font-bold text-[#121111] dark:text-slate-100 font-heading">{draft.title}</h4>
                      <p className="text-[10px] text-[#5B5B66] dark:text-slate-500">Video: {draft.videoTitle}</p>
                    </div>

                    {draft.id && (
                      <button
                        onClick={() => onDeleteDraft(draft.id!)}
                        className="text-[#5B5B66] hover:text-rose-600 dark:text-slate-500 dark:hover:text-rose-400 transition-colors p-1"
                        title="Eliminar borrador"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="rounded-xl bg-[#FAFAFA] dark:bg-slate-950 p-3.5 font-mono text-[11px] text-[#121111] dark:text-slate-300 line-clamp-4 leading-relaxed border border-neutral-200/60 dark:border-slate-800/60">
                    {draft.content}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[10px] text-[#5B5B66] dark:text-slate-500">
                    <span className="font-mono tabular-nums">
                      {new Date(draft.createdAt).toLocaleString('es-ES')}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(draft.content);
                      }}
                      className="text-[#2848F0] hover:underline font-semibold dark:text-slate-400 dark:hover:text-white transition-colors"
                    >
                      Copiar texto
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-[#5B5B66] dark:text-slate-500 rounded-2xl border border-dashed border-neutral-200 dark:border-slate-800/80 bg-[#FAFAFA] dark:bg-transparent">
              No hay borradores de IA guardados. Ve a la pestaña &quot;Repurposing IA&quot; para crear uno.
            </div>
          )}
        </div>
      )}

      {/* Diálogo de confirmación para vaciar datos */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-base font-bold text-[#121111] dark:text-white font-heading">
                ¿Vaciar toda la base de datos local?
              </h3>
            </div>
            <p className="text-xs text-[#5B5B66] dark:text-slate-300 leading-relaxed">
              Esta acción eliminará todos los videos, transcripciones y borradores de IA almacenados en IndexedDB en este navegador. Esta acción es irreversible.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-xl border border-neutral-200 bg-[#FAFAFA] px-4 py-2 text-xs font-semibold text-[#121111] hover:bg-neutral-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await onClearAllData();
                  setShowClearConfirm(false);
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition-colors shadow-2xs"
              >
                Sí, vaciar IndexedDB
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
