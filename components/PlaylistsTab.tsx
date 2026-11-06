'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ListMusic,
  Plus,
  Play,
  Trash2,
  Clock,
  ArrowLeft,
  SkipForward,
  SkipBack,
  Shuffle,
  Repeat,
  ExternalLink,
  Search,
  Check,
  AlertCircle,
  X,
  Music2,
  Video,
  ListPlus,
  Layers,
  Loader2,
} from 'lucide-react';
import { UserPlaylist, PlaylistItem, YouTubeSearchResultItem } from '@/lib/types';
import { getContentRepository } from '@/lib/repository';
import { extractVideoId } from '@/lib/youtube';

interface PlaylistsTabProps {
  onOpenVideoWatch?: (video: YouTubeSearchResultItem) => void;
  onNavigateToSearch: () => void;
}

const PLAYLIST_COLORS = [
  { id: '#2848F0', label: 'Azul Pro', bg: 'bg-blue-600' },
  { id: '#E11D48', label: 'Rojo Carmesí', bg: 'bg-rose-600' },
  { id: '#9333EA', label: 'Púrpura Neón', bg: 'bg-purple-600' },
  { id: '#059669', label: 'Esmeralda', bg: 'bg-emerald-600' },
  { id: '#D97706', label: 'Ámbar Dorado', bg: 'bg-amber-600' },
];

export function PlaylistsTab({ onOpenVideoWatch, onNavigateToSearch }: PlaylistsTabProps) {
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(0);
  const [isAutoPlayNext, setIsAutoPlayNext] = useState(true);
  const [isShuffle, setIsShuffle] = useState(false);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');
  const [newPlaylistColor, setNewPlaylistColor] = useState(PLAYLIST_COLORS[0].id);

  const [playlistToDelete, setPlaylistToDelete] = useState<{ id: string; name: string } | null>(null);

  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false);
  const [addVideoInput, setAddVideoInput] = useState('');
  const [addVideoError, setAddVideoError] = useState<string | null>(null);
  const [isAddingVideo, setIsAddingVideo] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const repository = getContentRepository();

  const loadPlaylists = useCallback(async () => {
    try {
      const list = await repository.getAllPlaylists();
      setPlaylists(list);
    } catch {
      // Manejo silencioso
    }
  }, [repository]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const list = await repository.getAllPlaylists();
        if (isMounted) setPlaylists(list);
      } catch {
        // Manejo silencioso
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [repository]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    try {
      const pl = await repository.createPlaylist(
        newPlaylistName.trim(),
        newPlaylistDesc.trim(),
        newPlaylistColor
      );
      setNewPlaylistName('');
      setNewPlaylistDesc('');
      setIsCreateModalOpen(false);
      await loadPlaylists();
      showToast(`¡Lista "${pl.name}" creada con éxito!`);
    } catch {
      // Manejo silencioso
    }
  };

  const handleDeletePlaylist = (id: string, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPlaylistToDelete({ id, name });
  };

  const confirmDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    const { id, name } = playlistToDelete;
    await repository.deletePlaylist(id);
    if (activePlaylistId === id) setActivePlaylistId(null);
    await loadPlaylists();
    setPlaylistToDelete(null);
    showToast(`Lista "${name}" eliminada`);
  };

  const handleAddVideoToActive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addVideoInput.trim() || !activePlaylistId) return;

    setIsAddingVideo(true);
    setAddVideoError(null);

    try {
      const id = extractVideoId(addVideoInput.trim()) || addVideoInput.trim();
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) {
        throw new Error('ID o enlace de video de YouTube no válido.');
      }

      // Obtener metadatos básicos
      const res = await fetch(`/api/youtube/metadata?videoId=${id}`);
      const data = await res.json();

      const item: PlaylistItem = {
        id,
        title: data.title || `Video (${id})`,
        channelTitle: data.channelTitle || 'YouTube',
        thumbnailUrl: data.thumbnails?.hq?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        durationText: data.duration || '04:00',
        durationSeconds: data.durationSeconds || 240,
        addedAt: Date.now(),
      };

      await repository.addVideoToPlaylist(activePlaylistId, item);
      await loadPlaylists();
      setAddVideoInput('');
      setIsAddVideoModalOpen(false);
      showToast(`¡Video añadido a la lista!`);
    } catch (err: unknown) {
      setAddVideoError((err as Error).message || 'Error al añadir video');
    } finally {
      setIsAddingVideo(false);
    }
  };

  const handleRemoveItem = async (playlistId: string, videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await repository.removeVideoFromPlaylist(playlistId, videoId);
    await loadPlaylists();
    showToast('Video retirado de la lista');
  };

  const activePlaylist = playlists.find((p) => p.id === activePlaylistId) || null;
  const currentVideo = activePlaylist?.items[currentPlayingIndex] || null;

  // Control de reproducción siguiente / previa
  const handleNextVideo = () => {
    if (!activePlaylist || activePlaylist.items.length === 0) return;
    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * activePlaylist.items.length);
      setCurrentPlayingIndex(nextIdx);
    } else {
      setCurrentPlayingIndex((prev) => (prev + 1) % activePlaylist.items.length);
    }
  };

  const handlePrevVideo = () => {
    if (!activePlaylist || activePlaylist.items.length === 0) return;
    setCurrentPlayingIndex((prev) =>
      prev === 0 ? activePlaylist.items.length - 1 : prev - 1
    );
  };

  // Calcular duración total de la lista
  const formatTotalDuration = (items: PlaylistItem[]) => {
    const totalSec = items.reduce((acc, curr) => acc + (curr.durationSeconds || 240), 0);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    if (hours > 0) return `${hours} h ${minutes} min`;
    return `${minutes} min`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast de confirmación */}
      {toastMessage && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200 shadow-xs">
          <Check className="h-4 w-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* VISTA 1: Lista detallada de una Playlist abierta */}
      {activePlaylist ? (
        <div className="space-y-6">
          {/* Navegación y Encabezado de la Playlist */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              onClick={() => setActivePlaylistId(null)}
              className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 px-4 py-2 text-xs font-bold text-[#121111] dark:text-slate-100 shadow-2xs hover:shadow-xs transition-all cursor-pointer self-start"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver a todas las listas</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDeletePlaylist(activePlaylist.id, activePlaylist.name)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 text-rose-600 dark:text-rose-400 px-3 py-2 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                title="Eliminar esta lista"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Eliminar lista</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddVideoModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 text-white px-3.5 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Añadir Video a esta lista</span>
              </button>
            </div>
          </div>

          {/* Banner de la lista activa */}
          <div className="rounded-3xl border border-neutral-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-md shrink-0"
                style={{ backgroundColor: activePlaylist.color || '#2848F0' }}
              >
                <ListMusic className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-bold text-[#121111] dark:text-white font-heading">
                  {activePlaylist.name}
                </h2>
                <p className="text-xs text-[#5B5B66] dark:text-slate-400">
                  {activePlaylist.description || 'Lista de reproducción con reproducción continua'}
                </p>
                <div className="flex items-center gap-3 text-xs font-mono text-[#5B5B66] dark:text-slate-400 pt-1">
                  <span className="font-semibold text-[#121111] dark:text-slate-200">
                    {activePlaylist.items.length} {activePlaylist.items.length === 1 ? 'video' : 'videos'}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Duración total: {formatTotalDuration(activePlaylist.items)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Controles globales de reproducción continua */}
            {activePlaylist.items.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsShuffle(!isShuffle)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isShuffle
                      ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                      : 'bg-neutral-100 text-[#5B5B66] border-transparent hover:bg-neutral-200/70 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                  title="Modo aleatorio"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                  <span>Aleatorio</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAutoPlayNext(!isAutoPlayNext)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isAutoPlayNext
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-neutral-100 text-[#5B5B66] border-transparent hover:bg-neutral-200/70 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                  title="Reproducir automáticamente el siguiente video"
                >
                  <Repeat className="h-3.5 w-3.5" />
                  <span>Continuo: {isAutoPlayNext ? 'Activado' : 'Manual'}</span>
                </button>
              </div>
            )}
          </div>

          {/* REPRODUCTOR CONTINUO SI HAY VIDEOS */}
          {activePlaylist.items.length > 0 && currentVideo ? (
            <div className="space-y-4 rounded-3xl border border-neutral-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-slate-800">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] font-bold tracking-wider text-[#2848F0] dark:text-rose-400 uppercase block font-mono">
                    Reproduciendo {currentPlayingIndex + 1} de {activePlaylist.items.length}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-[#121111] dark:text-white truncate font-heading">
                    {currentVideo.title}
                  </h3>
                  <span className="text-xs text-[#5B5B66] dark:text-slate-400">
                    {currentVideo.channelTitle}
                  </span>
                </div>

                {/* Barra de botones Siguiente / Anterior */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handlePrevVideo}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 text-xs font-bold text-[#121111] dark:text-slate-200 transition-colors cursor-pointer"
                    title="Video anterior"
                  >
                    <SkipBack className="h-3.5 w-3.5" />
                    <span>Anterior</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNextVideo}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
                    title="Siguiente video"
                  >
                    <span>Siguiente</span>
                    <SkipForward className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Iframe del video actual en 16:9 con autoplay */}
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-md border border-neutral-200 dark:border-slate-800">
                <iframe
                  key={currentVideo.id}
                  src={`https://www.youtube.com/embed/${currentVideo.id}?autoplay=1&enablejsapi=1&rel=0`}
                  title={currentVideo.title}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/30 p-12 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-[#2848F0] dark:bg-slate-800 dark:text-rose-400">
                <Music2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
                  Esta lista de reproducción está vacía
                </h3>
                <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md mx-auto">
                  Añade videos o canciones pegando su enlace de YouTube o buscando desde el buscador general.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddVideoModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 text-white px-4 py-2.5 text-xs font-bold shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Añadir primer video</span>
              </button>
            </div>
          )}

          {/* LISTA DE VIDEOS DE LA PLAYLIST */}
          {activePlaylist.items.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-[#5B5B66] dark:text-slate-400 uppercase font-mono px-1">
                Pistas y Videos en la Lista ({activePlaylist.items.length})
              </h4>

              <div className="space-y-2">
                {activePlaylist.items.map((item, index) => {
                  const isCurrent = index === currentPlayingIndex;
                  return (
                    <div
                      key={`${item.id}-${index}`}
                      onClick={() => setCurrentPlayingIndex(index)}
                      className={`group flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'border-[#2848F0] bg-[#EEF1F8]/80 dark:border-rose-500 dark:bg-rose-950/20 shadow-xs'
                          : 'border-neutral-200/90 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Número o Indicador de reproducción */}
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl font-mono text-xs font-bold shrink-0">
                          {isCurrent ? (
                            <Play className="h-4 w-4 text-[#2848F0] dark:text-rose-400 fill-current animate-pulse" />
                          ) : (
                            <span className="text-[#5B5B66] dark:text-slate-400">{index + 1}</span>
                          )}
                        </div>

                        {/* Miniatura */}
                        <div className="relative h-12 w-20 rounded-lg overflow-hidden bg-neutral-900 shrink-0">
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </div>

                        {/* Info */}
                        <div className="min-w-0 space-y-0.5">
                          <h5
                            className={`text-xs font-bold truncate leading-tight ${
                              isCurrent
                                ? 'text-[#2848F0] dark:text-rose-400'
                                : 'text-[#121111] dark:text-slate-200 group-hover:text-[#2848F0] dark:group-hover:text-rose-400'
                            }`}
                            title={item.title}
                          >
                            {item.title}
                          </h5>
                          <p className="text-[11px] text-[#5B5B66] dark:text-slate-400 truncate">
                            {item.channelTitle}
                          </p>
                        </div>
                      </div>

                      {/* Duración y Botón de eliminar */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-mono text-[#5B5B66] dark:text-slate-400">
                          {item.durationText || '04:00'}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => handleRemoveItem(activePlaylist.id, item.id, e)}
                          className="p-1.5 rounded-lg text-[#5B5B66] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Eliminar de la lista"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VISTA 2: Cuadrícula con todas las Listas de Reproducción creadas */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-neutral-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-6 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2848F0]/10 text-[#2848F0] dark:bg-rose-500/20 dark:text-rose-400">
                  <ListMusic className="h-4 w-4" />
                </div>
                <h2 className="text-xl font-bold text-[#121111] dark:text-slate-100 font-heading">
                  Listas de Reproducción Continuas
                </h2>
              </div>
              <p className="text-xs text-[#5B5B66] dark:text-slate-400">
                Organiza tus videos y música en playlists personalizadas con reproducción continua automática uno tras otro.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition-all cursor-pointer self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Crear Nueva Lista</span>
            </button>
          </div>

          {/* Cuadrícula de Playlists */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {playlists.map((playlist) => {
              const videoCount = playlist.items.length;
              const firstThumb = playlist.items[0]?.thumbnailUrl;

              return (
                <div
                  key={playlist.id}
                  onClick={() => {
                    setActivePlaylistId(playlist.id);
                    setCurrentPlayingIndex(0);
                  }}
                  className="group flex flex-col justify-between rounded-3xl border border-neutral-200/90 bg-white overflow-hidden shadow-xs hover:shadow-md transition-all hover:border-neutral-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 cursor-pointer"
                >
                  {/* Cabecera / Portada */}
                  <div
                    className="relative h-32 w-full p-4 flex flex-col justify-between text-white overflow-hidden"
                    style={{ backgroundColor: playlist.color || '#2848F0' }}
                  >
                    {firstThumb && (
                      <img
                        src={firstThumb}
                        alt={playlist.name}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-500"
                      />
                    )}

                    <div className="flex items-center justify-between relative z-10">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/30 backdrop-blur-xs">
                        <ListMusic className="h-4 w-4" />
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleDeletePlaylist(playlist.id, playlist.name, e)}
                        className="p-1.5 rounded-lg bg-black/20 hover:bg-black/50 text-white/80 hover:text-white transition-colors cursor-pointer"
                        title="Eliminar lista"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="relative z-10 flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                        {videoCount} {videoCount === 1 ? 'canción/video' : 'canciones/videos'}
                      </span>
                    </div>
                  </div>

                  {/* Contenido */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-[#121111] dark:text-white font-heading group-hover:text-[#2848F0] dark:group-hover:text-rose-400 transition-colors">
                        {playlist.name}
                      </h3>
                      <p className="text-xs text-[#5B5B66] dark:text-slate-400 line-clamp-2">
                        {playlist.description || 'Sin descripción'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-neutral-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-[#2848F0] dark:text-rose-400 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Abrir y reproducir</span>
                      </span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Crear Nueva Lista de Reproducción */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ListPlus className="h-5 w-5 text-[#2848F0] dark:text-rose-500" />
                <h3 className="text-base font-bold text-[#121111] dark:text-white font-heading">
                  Crear Lista de Reproducción
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-[#121111] dark:text-slate-200">
                  Nombre de la lista
                </label>
                <input
                  type="text"
                  required
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="ej. Mis Canciones Favoritas, Mix de Rock, Tutoriales..."
                  className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 px-3 text-xs text-[#121111] placeholder-[#5B5B66]/70 focus:border-[#2848F0] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#121111] dark:text-slate-200">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  placeholder="Descripción de la lista de canciones o videos..."
                  className="w-full rounded-xl border border-neutral-200 bg-white py-2 px-3 text-xs text-[#121111] placeholder-[#5B5B66]/70 focus:border-[#2848F0] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-[#121111] dark:text-slate-200">
                  Color distintivo
                </label>
                <div className="flex items-center gap-2">
                  {PLAYLIST_COLORS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => setNewPlaylistColor(col.id)}
                      className={`h-7 w-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        col.bg
                      } ${newPlaylistColor === col.id ? 'ring-2 ring-offset-2 ring-[#2848F0] scale-110' : ''}`}
                    >
                      {newPlaylistColor === col.id && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newPlaylistName.trim()}
                  className="px-5 py-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  Crear Lista
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Añadir Video a la Lista Activa */}
      {isAddVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-[#2848F0] dark:text-rose-500" />
                <h3 className="text-base font-bold text-[#121111] dark:text-white font-heading">
                  Añadir Video a {activePlaylist?.name || 'la lista'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddVideoModalOpen(false)}
                className="text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddVideoToActive} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-[#121111] dark:text-slate-200">
                  Enlace de YouTube o ID del video
                </label>
                <input
                  type="text"
                  required
                  value={addVideoInput}
                  onChange={(e) => setAddVideoInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... o ID"
                  className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 px-3 text-xs text-[#121111] placeholder-[#5B5B66]/70 focus:border-[#2848F0] focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-2xs"
                />
              </div>

              {addVideoError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-400 flex items-center gap-1.5 font-medium">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{addVideoError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddVideoModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!addVideoInput.trim() || isAddingVideo}
                  className="px-5 py-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isAddingVideo ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Añadiendo...</span>
                    </>
                  ) : (
                    <span>Añadir Video</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirmar Eliminación de Lista */}
      {playlistToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 shrink-0">
                <Trash2 className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-[#121111] dark:text-white font-heading">
                  ¿Eliminar lista?
                </h3>
                <p className="text-xs text-[#5B5B66] dark:text-slate-400">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <p className="text-xs text-[#5B5B66] dark:text-slate-300 leading-relaxed">
              ¿Deseas eliminar permanentemente la lista de reproducción <strong className="text-[#121111] dark:text-white">&quot;{playlistToDelete.name}&quot;</strong>?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPlaylistToDelete(null)}
                className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeletePlaylist}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
