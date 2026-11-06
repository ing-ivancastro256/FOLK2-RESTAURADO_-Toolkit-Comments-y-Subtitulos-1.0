'use client';

import React, { useState, useEffect } from 'react';
import {
  Star,
  Users,
  Video,
  Play,
  Layers,
  Music2,
  Trash2,
  ExternalLink,
  Search,
  Sparkles,
  Calendar,
  Eye,
  Clock,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { FavoriteChannel, YouTubeVideoMetadata, YouTubeSearchResultItem } from '@/lib/types';
import { getContentRepository } from '@/lib/repository';

interface FavoritesTabProps {
  onOpenChannel: (channelQuery: string) => void;
  onOpenVideoWatch: (video: YouTubeSearchResultItem) => void;
  onInspectVideo?: (videoId: string) => void;
  onDownloadAudioVideo: (videoId: string) => void;
  onNavigateToSearch: () => void;
}

export function FavoritesTab({
  onOpenChannel,
  onOpenVideoWatch,
  onInspectVideo: _onInspectVideo,
  onDownloadAudioVideo,
  onNavigateToSearch,
}: FavoritesTabProps) {
  const [subTab, setSubTab] = useState<'channels' | 'videos'>('channels');
  const [channels, setChannels] = useState<FavoriteChannel[]>([]);
  const [favoriteVideos, setFavoriteVideos] = useState<YouTubeVideoMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const repository = getContentRepository();

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const [favChannels, allVideos] = await Promise.all([
          repository.getFavoriteChannels(),
          repository.getAllVideos(),
        ]);
        if (isMounted) {
          setChannels(favChannels);
          setFavoriteVideos(allVideos.filter((v) => v.isFavorite));
          setIsLoading(false);
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [repository]);

  const handleRemoveChannel = async (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await repository.removeFavoriteChannel(channelId);
    setChannels((prev) => prev.filter((c) => c.channelId !== channelId));
  };

  const handleRemoveVideoFavorite = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await repository.toggleFavorite(videoId);
    setFavoriteVideos((prev) => prev.filter((v) => v.videoId !== videoId));
  };

  const handleOpenWatch = (vid: YouTubeVideoMetadata) => {
    onOpenVideoWatch({
      id: vid.videoId,
      title: vid.title,
      description: vid.description || '',
      channelTitle: vid.channelTitle || 'Canal',
      publishedAt: vid.publishedAt || 'Reciente',
      thumbnailUrl:
        vid.thumbnails?.hq?.url ||
        vid.thumbnails?.mq?.url ||
        vid.thumbnails?.default?.url ||
        `https://img.youtube.com/vi/${vid.videoId}/hqdefault.jpg`,
      durationText: vid.duration || '05:00',
      viewCountText: vid.viewCount || '10 K vistas',
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header con Pestañas Sub-Filtros: Canales Favoritos / Videos Favoritos */}
      <div className="rounded-2xl border border-neutral-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 dark:bg-amber-500/20">
                <Star className="h-4 w-4 fill-current" />
              </div>
              <h2 className="text-xl font-bold text-[#121111] dark:text-slate-100 font-heading">
                Colección de Favoritos
              </h2>
            </div>
            <p className="text-xs text-[#5B5B66] dark:text-slate-400">
              Accede rápidamente a tus creadores de contenido y videos destacados guardados localmente.
            </p>
          </div>

          {/* Selector de Sub-Pestaña: Canales vs Videos */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-slate-800 rounded-xl border border-neutral-200/60 dark:border-slate-700/60 self-start sm:self-auto">
            <button
              onClick={() => setSubTab('channels')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                subTab === 'channels'
                  ? 'bg-white text-[#121111] shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Canales Favoritos ({channels.length})</span>
            </button>

            <button
              onClick={() => setSubTab('videos')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                subTab === 'videos'
                  ? 'bg-white text-[#121111] shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Video className="h-3.5 w-3.5" />
              <span>Videos Favoritos ({favoriteVideos.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SUBTAB: CANALES FAVORITOS */}
      {subTab === 'channels' && (
        <div className="space-y-4">
          {channels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {channels.map((ch) => (
                <div
                  key={ch.channelId}
                  onClick={() => onOpenChannel(ch.handle || ch.title)}
                  className="group relative flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-xs hover:shadow-md transition-all hover:border-neutral-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 cursor-pointer overflow-hidden"
                >
                  <div className="space-y-4">
                    {/* Fila Avatar y Botón Eliminar */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={ch.avatarUrl}
                          alt={ch.title}
                          referrerPolicy="no-referrer"
                          className="h-14 w-14 rounded-full object-cover border border-neutral-200 dark:border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-[#121111] dark:text-slate-100 font-heading truncate group-hover:text-[#2848F0] dark:group-hover:text-rose-400 transition-colors">
                            {ch.title}
                          </h3>
                          <span className="text-xs text-[#2848F0] dark:text-rose-400 font-mono font-medium block truncate">
                            {ch.handle || `@${ch.title.toLowerCase().replace(/\s+/g, '')}`}
                          </span>
                          <span className="text-[11px] text-[#5B5B66] dark:text-slate-400 font-semibold block">
                            {ch.subscriberCount || 'Suscriptores'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleRemoveChannel(ch.channelId, e)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Quitar de favoritos"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {ch.description && (
                      <p className="text-xs text-[#5B5B66] dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {ch.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 mt-2 border-t border-neutral-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-bold text-[#2848F0] dark:text-rose-400">
                    <span>Ver canal y todos sus videos</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/30 p-12 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40 shadow-xs">
                <Users className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
                  No tienes canales en favoritos todavía
                </h3>
                <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md mx-auto">
                  Busca cualquier creador por su usuario (@handle) o URL y pulsa <strong>&quot;Agregar a Favoritos&quot;</strong> para fijarlo aquí.
                </p>
              </div>
              <button
                onClick={onNavigateToSearch}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-xs cursor-pointer"
              >
                <Search className="h-4 w-4" />
                <span>Buscar Creadores o Videos</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. SUBTAB: VIDEOS FAVORITOS */}
      {subTab === 'videos' && (
        <div className="space-y-4">
          {favoriteVideos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {favoriteVideos.map((vid) => (
                <div
                  key={vid.videoId}
                  className="group flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-xs hover:shadow-md transition-all hover:border-neutral-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
                >
                  <div>
                    {/* Miniatura con duración */}
                    <div
                      onClick={() => handleOpenWatch(vid)}
                      className="relative aspect-video w-full overflow-hidden bg-neutral-900 cursor-pointer"
                    >
                      <img
                        src={vid.thumbnails.hq.url}
                        alt={vid.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#121111] shadow-lg">
                          <Play className="h-5 w-5 fill-current ml-0.5" />
                        </div>
                      </div>

                      <div className="absolute bottom-2 right-2">
                        <span className="rounded-md bg-black/85 px-2 py-0.5 text-[11px] font-mono font-bold text-white backdrop-blur-xs">
                          {vid.duration || '05:00'}
                        </span>
                      </div>

                      <button
                        onClick={(e) => handleRemoveVideoFavorite(vid.videoId, e)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-rose-600 text-white transition-colors cursor-pointer z-10"
                        title="Quitar de favoritos"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="p-4 space-y-2">
                      <h4
                        onClick={() => handleOpenWatch(vid)}
                        className="text-xs sm:text-sm font-bold text-[#121111] dark:text-slate-100 font-heading line-clamp-2 leading-snug group-hover:text-[#2848F0] dark:group-hover:text-rose-400 transition-colors cursor-pointer"
                        title={vid.title}
                      >
                        {vid.title}
                      </h4>
                      <p className="text-xs text-[#5B5B66] dark:text-slate-400 font-medium truncate">
                        {vid.channelTitle}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 pt-0 grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => handleOpenWatch(vid)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 py-2 px-2 text-xs font-semibold text-[#121111] dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-400 fill-current" />
                      <span>Ver Video</span>
                    </button>

                    <button
                      onClick={() => onDownloadAudioVideo(vid.videoId)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 py-2 px-2 text-xs font-bold text-white transition-colors cursor-pointer"
                    >
                      <Music2 className="h-3.5 w-3.5" />
                      <span>Descargar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/30 p-12 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/40 shadow-xs">
                <Star className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
                  No tienes videos en favoritos aún
                </h3>
                <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md mx-auto">
                  En el Inspector o en la Biblioteca, pulsa sobre la estrella de cualquier video para guardarlo aquí y tener acceso inmediato.
                </p>
              </div>
              <button
                onClick={onNavigateToSearch}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-xs cursor-pointer"
              >
                <Search className="h-4 w-4" />
                <span>Explorar Videos</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
