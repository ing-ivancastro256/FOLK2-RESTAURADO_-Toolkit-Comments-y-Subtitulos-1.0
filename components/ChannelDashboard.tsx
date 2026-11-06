'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Star,
  Video,
  Eye,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Play,
  Download,
  Check,
  Loader2,
  ShieldCheck,
  Share2,
  Copy,
} from 'lucide-react';
import { ChannelDetails, YouTubeSearchResultItem } from '@/lib/types';
import { getContentRepository } from '@/lib/repository';
import { copyTextToClipboard, getYouTubeVideoUrl } from '@/lib/youtube';
import { YouTubeWatchViewer } from '@/components/YouTubeWatchViewer';

interface ChannelDashboardProps {
  channel: ChannelDetails;
  onBack: () => void;
  onSelectVideoForWatch?: (video: YouTubeSearchResultItem) => void;
  onDownloadAudioVideo: (videoId: string) => void;
  apiKey?: string;
  onChannelFavoriteChanged?: () => void;
}

export function ChannelDashboard({
  channel,
  onBack,
  onSelectVideoForWatch,
  onDownloadAudioVideo,
  apiKey,
  onChannelFavoriteChanged,
}: ChannelDashboardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'views_desc' | 'views_asc' | 'date_desc' | 'date_asc'>('views_desc');
  const [videos, setVideos] = useState<YouTubeSearchResultItem[]>(channel.videos || []);
  const [isSortingLoading, setIsSortingLoading] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedVideoId, setCopiedVideoId] = useState<string | null>(null);
  const [favoriteSuccessToast, setFavoriteSuccessToast] = useState<string | null>(null);

  const handleCopyCardLink = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    e.preventDefault();
    await copyTextToClipboard(getYouTubeVideoUrl(videoId));
    setCopiedVideoId(videoId);
    setTimeout(() => {
      setCopiedVideoId((prev) => (prev === videoId ? null : prev));
    }, 2000);
  };

  // Video seleccionado para la vista directa de ficha tipo YouTube Watch
  const [activeWatchVideo, setActiveWatchVideo] = useState<YouTubeSearchResultItem | null>(null);

  const repository = getContentRepository();

  // Verificar si el canal ya está guardado en favoritos de IndexedDB
  useEffect(() => {
    let isMounted = true;
    void (async () => {
      const fav = await repository.isFavoriteChannel(channel.channelId);
      if (isMounted) setIsFavorite(fav);
    })();
    return () => {
      isMounted = false;
    };
  }, [channel.channelId, repository]);

  // Actualizar videos cuando cambia el canal según el patrón recomendado de React
  const [prevChannelId, setPrevChannelId] = useState(channel.channelId);
  if (channel.channelId !== prevChannelId) {
    setPrevChannelId(channel.channelId);
    setVideos(channel.videos || []);
    setActiveWatchVideo(null);
  }

  // Alternar favorito del canal
  const handleToggleFavorite = async () => {
    try {
      if (isFavorite) {
        await repository.removeFavoriteChannel(channel.channelId);
        setIsFavorite(false);
        setFavoriteSuccessToast('Canal eliminado de tus favoritos');
      } else {
        await repository.saveFavoriteChannel({
          channelId: channel.channelId,
          title: channel.title,
          handle: channel.handle,
          customUrl: channel.customUrl,
          avatarUrl: channel.avatarUrl,
          bannerUrl: channel.bannerUrl,
          subscriberCount: channel.subscriberCount,
          videoCount: channel.videoCount,
          description: channel.description,
          addedAt: Date.now(),
        });
        setIsFavorite(true);
        setFavoriteSuccessToast(`¡${channel.title} añadido a Canales Favoritos!`);
      }
      if (onChannelFavoriteChanged) onChannelFavoriteChanged();
      setTimeout(() => setFavoriteSuccessToast(null), 3000);
    } catch {
      // Manejo silencioso
    }
  };

  // Reordenar videos por vista o fecha
  const handleChangeSort = async (newSort: 'views_desc' | 'views_asc' | 'date_desc' | 'date_asc') => {
    setSortBy(newSort);
    setIsSortingLoading(true);

    try {
      const sorted = [...videos];
      if (newSort === 'views_desc') {
        sorted.sort((a: any, b: any) => (b.viewsNumber || 0) - (a.viewsNumber || 0));
      } else if (newSort === 'views_asc') {
        sorted.sort((a: any, b: any) => (a.viewsNumber || 0) - (b.viewsNumber || 0));
      } else if (newSort === 'date_desc') {
        sorted.sort((a: any, b: any) => (b.publishedTimestamp || 0) - (a.publishedTimestamp || 0));
      } else if (newSort === 'date_asc') {
        sorted.sort((a: any, b: any) => (a.publishedTimestamp || 0) - (b.publishedTimestamp || 0));
      }
      setVideos(sorted);
    } finally {
      setIsSortingLoading(false);
    }
  };

  const handleShareChannel = () => {
    const channelLink = `https://www.youtube.com/${channel.handle || `channel/${channel.channelId}`}`;
    navigator.clipboard.writeText(channelLink);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleOpenVideoFicha = (video: YouTubeSearchResultItem) => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    if (onSelectVideoForWatch) {
      onSelectVideoForWatch(video);
    } else {
      setActiveWatchVideo(video);
    }
  };

  // Si hay un video activo seleccionado dentro del canal, renderizar su ficha completa directamente
  if (activeWatchVideo) {
    return (
      <YouTubeWatchViewer
        video={activeWatchVideo}
        onBackToResults={() => setActiveWatchVideo(null)}
        apiKey={apiKey}
        onFavoriteChanged={onChannelFavoriteChanged}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Barra de Navegación "Atrás" */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 px-4 py-2 text-xs font-bold text-[#121111] dark:text-slate-100 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver al Buscador de Canales</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareChannel}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-[#5B5B66] dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
            title="Copiar enlace del canal"
          >
            {copiedShare ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Share2 className="h-3.5 w-3.5" />}
            <span>{copiedShare ? 'Enlace copiado' : 'Compartir'}</span>
          </button>

          <a
            href={`https://www.youtube.com/${channel.handle || `channel/${channel.channelId}`}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <span>Ver en YouTube</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Toast de confirmación de Favoritos */}
      {favoriteSuccessToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200 shadow-xs">
          <Check className="h-4 w-4 shrink-0" />
          <span>{favoriteSuccessToast}</span>
        </div>
      )}

      {/* 2. Banner de Portada del Canal */}
      <div className="relative rounded-3xl overflow-hidden border border-neutral-200/90 dark:border-slate-800 shadow-xs bg-neutral-900">
        <div className="h-36 sm:h-48 md:h-56 w-full relative">
          {channel.bannerUrl ? (
            <img
              src={channel.bannerUrl}
              alt={`Banner de ${channel.title}`}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-neutral-900 via-neutral-800 to-[#1e293b] flex items-center justify-center">
              <span className="text-white/20 text-4xl sm:text-6xl font-bold font-heading select-none">
                {channel.title}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        {/* 3. Encabezado del Perfil (Avatar + Info + Botones) */}
        <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-end justify-between gap-5 -mt-12 sm:-mt-14 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Avatar del canal */}
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full p-1 bg-white dark:bg-slate-900 shadow-xl shrink-0">
              <img
                src={channel.avatarUrl}
                alt={channel.title}
                referrerPolicy="no-referrer"
                className="h-full w-full rounded-full object-cover border border-neutral-200 dark:border-slate-700"
              />
            </div>

            {/* Datos del Canal */}
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#121111] dark:text-white font-heading leading-tight truncate">
                  {channel.title}
                </h1>
                <span title="Canal Verificado">
                  <ShieldCheck className="h-5 w-5 text-[#2848F0] dark:text-rose-400 shrink-0" />
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#5B5B66] dark:text-slate-400">
                <span className="font-bold text-[#2848F0] dark:text-rose-400 font-mono">
                  {channel.handle || `@${channel.title.replace(/\s+/g, '').toLowerCase()}`}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-[#121111] dark:text-slate-200">
                  {channel.subscriberCount || 'Suscriptores no revelados'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{channel.videoCount || `${videos.length} videos`}</span>
              </div>
            </div>
          </div>

          {/* Botón de Favoritos y Acciones Principales */}
          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <button
              onClick={handleToggleFavorite}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                isFavorite
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                  : 'bg-[#1C1C1C] hover:bg-[#2E2E2E] dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900'
              }`}
            >
              <Star className={`h-4 w-4 ${isFavorite ? 'fill-current text-white' : ''}`} />
              <span>{isFavorite ? 'En Favoritos' : 'Agregar a Canales Favoritos'}</span>
            </button>
          </div>
        </div>

        {/* 4. Descripción Expandible e Información Adicional */}
        <div className="px-5 pb-5 sm:px-6 sm:pb-6 bg-white dark:bg-slate-900 border-t border-neutral-100 dark:border-slate-800/80 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs font-mono text-[#5B5B66] dark:text-slate-400">
              {channel.viewCount && (
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-400" />
                  <span>{channel.viewCount}</span>
                </span>
              )}
              {channel.joinedDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Se unió en {channel.joinedDate}</span>
                </span>
              )}
            </div>

            {channel.description && (
              <button
                onClick={() => setIsDescExpanded(!isDescExpanded)}
                className="flex items-center gap-1 text-xs font-semibold text-[#2848F0] dark:text-rose-400 hover:underline cursor-pointer"
              >
                <span>{isDescExpanded ? 'Menos info' : 'Ver descripción completa'}</span>
                {isDescExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>

          {channel.description && isDescExpanded && (
            <div className="p-4 rounded-2xl bg-[#FAFAFA] dark:bg-slate-800/40 border border-neutral-200/80 dark:border-slate-800 text-xs text-[#5B5B66] dark:text-slate-300 leading-relaxed whitespace-pre-wrap animate-in fade-in duration-150">
              {channel.description}
            </div>
          )}
        </div>
      </div>

      {/* 5. SECCIÓN DE VIDEOS DEL CANAL CON ORDENAMIENTOS */}
      <div className="space-y-4">
        {/* Barra de Ordenamiento de Videos */}
        <div className="rounded-2xl border border-neutral-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-[#2848F0] dark:text-rose-400" />
            <h3 className="text-sm font-bold text-[#121111] dark:text-slate-100 font-heading">
              Videos de {channel.title} ({videos.length})
            </h3>
          </div>

          {/* Opciones de ordenamiento: Más vistos, Menos vistos, Más nuevos, Más antiguos */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[#5B5B66] dark:text-slate-400 font-medium flex items-center gap-1 mr-1">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>Ordenar:</span>
            </span>

            {[
              { id: 'views_desc', label: 'Más vistos' },
              { id: 'date_desc', label: 'Más nuevos' },
              { id: 'views_asc', label: 'Menos vistos' },
              { id: 'date_asc', label: 'Más antiguos' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleChangeSort(opt.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  sortBy === opt.id
                    ? 'bg-neutral-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                    : 'bg-neutral-100 text-[#5B5B66] hover:text-[#121111] hover:bg-neutral-200/70 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cuadrícula de videos */}
        {isSortingLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#2848F0]" />
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {videos.map((video) => (
              <div
                key={video.id}
                className="group flex flex-col rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-xs hover:shadow-md transition-all hover:border-neutral-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
              >
                {/* Miniatura con duración -> Abre la ficha del video */}
                <div
                  onClick={() => handleOpenVideoFicha(video)}
                  className="relative aspect-video w-full overflow-hidden bg-neutral-900 cursor-pointer"
                >
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[#121111] shadow-lg">
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleCopyCardLink(e, video.id)}
                    title="Copiar enlace del video"
                    aria-label="Copiar enlace del video"
                    className={`absolute top-2 right-2 z-10 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold shadow-md backdrop-blur-xs transition-all cursor-pointer ${
                      copiedVideoId === video.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-black/75 hover:bg-[#2848F0] text-white/95 hover:text-white border border-white/15'
                    }`}
                  >
                    {copiedVideoId === video.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 shrink-0" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <Copy className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>

                  <div className="absolute bottom-2 right-2">
                    <span className="rounded-md bg-black/85 px-2 py-0.5 text-[11px] font-mono font-bold text-white backdrop-blur-xs">
                      {video.durationText || '08:45'}
                    </span>
                  </div>
                </div>

                {/* Contenido -> Abre la ficha del video */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h4
                      onClick={() => handleOpenVideoFicha(video)}
                      className="text-xs sm:text-sm font-bold text-[#121111] dark:text-slate-100 font-heading line-clamp-2 leading-snug group-hover:text-[#2848F0] dark:group-hover:text-rose-400 transition-colors cursor-pointer"
                      title={video.title}
                    >
                      {video.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-[#5B5B66] dark:text-slate-400">
                      <span className="flex items-center gap-1 font-semibold text-[#121111] dark:text-slate-200">
                        <Eye className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-400" />
                        <span>{video.viewCountText || '50 K vistas'}</span>
                      </span>

                      {video.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{video.publishedAt}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones del video: Ver Ficha (Directo) y Descargar */}
                  <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-neutral-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handleOpenVideoFicha(video)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 py-1.5 px-2 text-xs font-semibold text-[#121111] dark:text-slate-200 transition-colors cursor-pointer"
                      title="Ver ficha del video, reproducir y comentarios"
                    >
                      <Play className="h-3 w-3 text-[#2848F0] dark:text-rose-400 fill-current" />
                      <span>Ver Ficha</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDownloadAudioVideo(video.id)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 py-1.5 px-2 text-xs font-bold text-white transition-colors cursor-pointer"
                      title="Descargar audio MP3 o video"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Descargar</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-slate-800 text-xs text-[#5B5B66] dark:text-slate-400">
            No se encontraron videos disponibles para este canal.
          </div>
        )}
      </div>
    </div>
  );
}
