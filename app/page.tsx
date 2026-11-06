'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, TabType } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { RepurposingStudioTab } from '@/components/RepurposingStudioTab';
import { LibraryTab } from '@/components/LibraryTab';
import { YouTubeSearchTab } from '@/components/YouTubeSearchTab';
import { ChannelDashboard } from '@/components/ChannelDashboard';
import { FavoritesTab } from '@/components/FavoritesTab';
import { DownloadsHubTab } from '@/components/DownloadsHubTab';
import { PlaylistsTab } from '@/components/PlaylistsTab';
import { YouTubeWatchViewer } from '@/components/YouTubeWatchViewer';
import { SettingsModal } from '@/components/SettingsModal';
import { PromptManagementTab } from '@/components/PromptManagementTab';
import { PromptOutputsTab } from '@/components/PromptOutputsTab';
import { getContentRepository } from '@/lib/repository';
import {
  YouTubeVideoMetadata,
  VideoTranscript,
  GeneratedContentItem,
  StorageEstimateInfo,
  VideoCommentsData,
  ChannelDetails,
  YouTubeSearchResultItem,
} from '@/lib/types';
import { useLocalStorageString, useLocalStorageBoolean } from '@/lib/useLocalStorage';
import {
  Search,
  Sparkles,
  Users,
  Loader2,
} from 'lucide-react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [resetSearchSignal, setResetSearchSignal] = useState(0);

  const [metadata, setMetadata] = useState<YouTubeVideoMetadata | null>(null);
  const [transcript, setTranscript] = useState<VideoTranscript | null>(null);
  const [commentsData, setCommentsData] = useState<VideoCommentsData | null>(null);
  const [activeWatchVideo, setActiveWatchVideo] = useState<YouTubeSearchResultItem | null>(null);

  const [savedVideos, setSavedVideos] = useState<YouTubeVideoMetadata[]>([]);
  const [savedAiDrafts, setSavedAiDrafts] = useState<GeneratedContentItem[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageEstimateInfo>({
    quotaBytes: 0,
    usageBytes: 0,
    percentageUsed: 0,
    quotaFormatted: 'Calculando...',
    usageFormatted: '0 B',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Estados de Canal / Usuario
  const [activeChannel, setActiveChannel] = useState<ChannelDetails | null>(null);
  const [isChannelLoading, setIsChannelLoading] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [channelInput, setChannelInput] = useState('');

  // Preferencias en LocalStorage
  const [apiKey, setApiKey] = useLocalStorageString('yt_api_key', '');
  const [theme, setTheme] = useLocalStorageString('yt_theme', 'dark');
  const [autoAnalyze, setAutoAnalyze] = useLocalStorageBoolean('yt_auto_analyze', true);

  const repository = getContentRepository();

  // Sincronizar tema oscuro
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Refrescar datos del historial e IndexedDB
  const refreshLibraryData = useCallback(async () => {
    try {
      const [videos, drafts, storage] = await Promise.all([
        repository.getAllVideos(),
        repository.getAllGeneratedContent(),
        repository.getStorageEstimate(),
      ]);
      setSavedVideos(videos);
      setSavedAiDrafts(drafts);
      setStorageInfo(storage);
    } catch {
      // Manejo silencioso
    }
  }, [repository]);

  // Cargar datos guardados inicialmente
  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const [videos, drafts, storage] = await Promise.all([
          repository.getAllVideos(),
          repository.getAllGeneratedContent(),
          repository.getStorageEstimate(),
        ]);
        if (!isMounted) return;
        setSavedVideos(videos);
        setSavedAiDrafts(drafts);
        setStorageInfo(storage);
      } catch {
        // Manejo silencioso inicial
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [repository]);

  const handleChangeTheme = (newTheme: string) => {
    setTheme(newTheme);
  };

  const handleSaveApiKey = (newKey: string) => {
    setApiKey(newKey);
  };

  // Reiniciar dashboard al estado limpio
  const handleResetDashboard = () => {
    setMetadata(null);
    setTranscript(null);
    setCommentsData(null);
  };

  // Abrir reproductor detallado de video tipo YouTube Watch
  const handleOpenWatchVideo = (video: YouTubeSearchResultItem) => {
    setActiveWatchVideo(video);
  };

  // Manejador de navegación de pestañas en la barra lateral
  const handleSelectTab = (tab: TabType) => {
    setActiveWatchVideo(null);
    if (tab === 'search') {
      // Si el usuario hace clic en Buscador de videos (incluso viendo un video en pantalla completa),
      // emitir la señal para salir inmediatamente del reproductor y mostrar el buscador
      setResetSearchSignal((prev) => prev + 1);
    }
    setActiveTab(tab);
  };

  // Flujo principal de análisis y carga de video
  const handleAnalyze = async (videoId: string, targetTab?: TabType) => {
    setIsLoading(true);

    // Limpiar estados de transcripción y comentarios previos
    setTranscript(null);
    setCommentsData(null);

    try {
      // 1. Consultar metadatos al backend
      const queryParams = new URLSearchParams({ videoId });
      if (apiKey) queryParams.set('apiKey', apiKey);

      const res = await fetch(`/api/youtube/metadata?${queryParams.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al obtener metadatos de YouTube');
      }

      setMetadata(data);
      if (targetTab) {
        setActiveTab(targetTab);
      } else {
        setActiveTab('downloads');
      }

      // 2. Guardar en IndexedDB
      await repository.saveVideo(data);

      // 3. Consultar transcripción en caché o solicitarla
      const cachedTranscript = await repository.getTranscript(videoId);
      if (cachedTranscript) {
        setTranscript(cachedTranscript);
      } else {
        void fetchTranscriptForVideo(videoId, apiKey);
      }

      // 4. Consultar comentarios en caché para este video
      const cachedComments = await repository.getComments(videoId);
      if (cachedComments && cachedComments.videoId === videoId) {
        setCommentsData(cachedComments);
      } else if (apiKey) {
        void fetchCommentsForVideo(videoId, apiKey);
      }

      await refreshLibraryData();
    } finally {
      setIsLoading(false);
    }
  };

  // Abrir y cargar datos completos del canal / usuario
  const handleOpenChannel = async (channelQuery: string) => {
    if (!channelQuery.trim()) return;
    setIsChannelLoading(true);
    setChannelError(null);
    setActiveTab('channel');

    try {
      const q = new URLSearchParams({ channel: channelQuery.trim() });
      if (apiKey) q.set('apiKey', apiKey);

      const res = await fetch(`/api/youtube/channel?${q.toString()}`);
      const data = await res.json();

      if (res.ok && data.channelId) {
        setActiveChannel(data);
      } else {
        setChannelError(data.error || 'No se pudo encontrar el canal solicitado.');
      }
    } catch (err: unknown) {
      setChannelError((err as Error).message || 'Error de conexión al cargar el canal');
    } finally {
      setIsChannelLoading(false);
    }
  };

  const fetchTranscriptForVideo = async (videoId: string, keyToUse?: string) => {
    try {
      const q = new URLSearchParams({ videoId });
      const key = keyToUse || apiKey;
      if (key) q.set('apiKey', key);

      const res = await fetch(`/api/youtube/transcript?${q.toString()}`);
      const data = await res.json();

      if (res.ok && data.segments) {
        setTranscript(data);
        await repository.saveTranscript(data);
      }
    } catch {
      // Manejo silencioso
    }
  };

  const fetchCommentsForVideo = async (videoId: string, keyToUse?: string) => {
    try {
      const q = new URLSearchParams({ videoId });
      const key = keyToUse || apiKey;
      if (key) q.set('apiKey', key);

      const res = await fetch(`/api/youtube/comments?${q.toString()}`);
      const data = await res.json();
      if (res.ok && data.comments) {
        setCommentsData(data);
        await repository.saveComments(data);
      }
    } catch {
      // Manejo silencioso
    }
  };

  const handleSaveAiDraft = async (item: Omit<GeneratedContentItem, 'id'>) => {
    await repository.saveGeneratedContent(item);
    await refreshLibraryData();
  };

  const handleSelectVideoFromLibrary = async (videoId: string) => {
    const video = savedVideos.find((v) => v.videoId === videoId);
    if (video) {
      setMetadata(video);
      setTranscript(null);
      setCommentsData(null);

      const [cachedTranscript, cachedComments] = await Promise.all([
        repository.getTranscript(videoId),
        repository.getComments(videoId),
      ]);
      setTranscript(cachedTranscript || null);
      if (cachedComments && cachedComments.videoId === videoId) {
        setCommentsData(cachedComments);
      } else {
        setCommentsData(null);
      }
      setActiveTab('downloads');
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    await repository.deleteVideo(videoId);
    if (metadata?.videoId === videoId) {
      handleResetDashboard();
    }
    await refreshLibraryData();
  };

  const handleDeleteDraft = async (id: number) => {
    await repository.deleteGeneratedContent(id);
    await refreshLibraryData();
  };

  const handleClearAllData = async () => {
    await repository.clearAllData();
    handleResetDashboard();
    setSavedVideos([]);
    setSavedAiDrafts([]);
    await refreshLibraryData();
  };

  return (
    <div className="min-h-screen bg-white text-[#121111] dark:bg-slate-950 dark:text-slate-100 flex transition-colors duration-200">
      {/* 1. BARRA LATERAL IZQUIERDA (Sidebar sin inspector, con Historial al final y tarjeta de usuario al pie) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        metadata={metadata}
        savedVideosCount={savedVideos.length}
        storageUsageFormatted={storageInfo.usageFormatted}
        theme={theme}
        onToggleTheme={() => handleChangeTheme(theme === 'dark' ? 'light' : 'dark')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onResetDashboard={handleResetDashboard}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. ÁREA CENTRAL DE TRABAJO */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Barra superior visible únicamente en móvil (en escritorio eliminada por completo para evitar redundancia) */}
        <Navbar onOpenMobileMenu={() => setIsMobileSidebarOpen(true)} />

        {/* Contenido principal según la pestaña activa o reproductor activo */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          {activeWatchVideo ? (
            <YouTubeWatchViewer
              video={activeWatchVideo}
              onBackToResults={() => setActiveWatchVideo(null)}
              apiKey={apiKey}
              onOpenChannel={handleOpenChannel}
              onFavoriteChanged={refreshLibraryData}
            />
          ) : (
            <>
              {/* TAB 1: Buscador de YouTube con Filtros (incluyendo En vivo y reseteo inmediato) */}
              {activeTab === 'search' && (
            <YouTubeSearchTab
              key="search-tab"
              initialType="video"
              onAnalyzeVideo={handleAnalyze}
              onDownloadAudioVideo={(vid) => handleAnalyze(vid, 'downloads')}
              onOpenChannel={handleOpenChannel}
              apiKey={apiKey}
              hasApiKey={Boolean(apiKey)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              resetSignal={resetSearchSignal}
              onFavoriteChanged={refreshLibraryData}
            />
          )}

          {/* TAB 2: Pestaña dedicada para YouTube Shorts */}
          {activeTab === 'shorts' && (
            <YouTubeSearchTab
              key="shorts-tab"
              initialType="short"
              onAnalyzeVideo={handleAnalyze}
              onDownloadAudioVideo={(vid) => handleAnalyze(vid, 'downloads')}
              onOpenChannel={handleOpenChannel}
              apiKey={apiKey}
              hasApiKey={Boolean(apiKey)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              resetSignal={resetSearchSignal}
              onFavoriteChanged={refreshLibraryData}
            />
          )}

          {/* TAB 3: Búsqueda por Usuario / Canal y Catálogo de Canal con Ficha Directa */}
          {activeTab === 'channel' && (
            <div>
              {isChannelLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-[#2848F0] dark:text-rose-500" />
                  <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
                    Cargando perfil y videos del canal...
                  </h3>
                  <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md">
                    Obteniendo avatar, portada, suscriptores y catálogo de videos ordenables.
                  </p>
                </div>
              ) : activeChannel ? (
                <ChannelDashboard
                  channel={activeChannel}
                  onBack={() => {
                    setActiveChannel(null);
                  }}
                  onDownloadAudioVideo={(vid) => handleAnalyze(vid, 'downloads')}
                  apiKey={apiKey}
                  onChannelFavoriteChanged={refreshLibraryData}
                />
              ) : (
                /* Estado para buscar cualquier canal */
                <div className="space-y-6">
                  <div className="rounded-3xl border border-neutral-200/90 bg-gradient-to-b from-[#FAFAFA] to-white p-8 sm:p-12 text-center dark:border-slate-800 dark:from-slate-900/60 dark:to-slate-950 shadow-xs space-y-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 border border-purple-200/40 text-purple-600 shadow-sm dark:bg-purple-950/50 dark:border-purple-900/40 dark:text-purple-400">
                      <Users className="h-7 w-7" />
                    </div>
                    <div className="space-y-1.5 max-w-xl mx-auto">
                      <h3 className="text-xl font-bold text-[#121111] dark:text-white font-heading">
                        Búsqueda por Usuario o Canal de YouTube
                      </h3>
                      <p className="text-xs sm:text-sm text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                        Ingresa el handle con arroba (ej. <strong>@MrBeast</strong>, <strong>@midudev</strong>), la URL completa del canal o su nombre para ver su perfil y todos sus videos ordenados por más vistos, menos vistos o fecha.
                      </p>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (channelInput.trim()) {
                          handleOpenChannel(channelInput.trim());
                        }
                      }}
                      className="max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-2 pt-2"
                    >
                      <input
                        type="text"
                        value={channelInput}
                        onChange={(e) => setChannelInput(e.target.value)}
                        placeholder="ej. @MrBeast, https://youtube.com/@midudev o nombre del canal"
                        className="w-full rounded-xl border border-neutral-200 bg-white py-3 px-4 text-xs sm:text-sm text-[#121111] placeholder-[#5B5B66]/70 focus:border-purple-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 shadow-2xs"
                      />
                      <button
                        type="submit"
                        disabled={!channelInput.trim() || isChannelLoading}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 py-3 px-6 text-xs sm:text-sm font-bold text-white shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <Search className="h-4 w-4" />
                        <span>Ver Canal</span>
                      </button>
                    </form>

                    {channelError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                        {channelError}
                      </p>
                    )}
                  </div>

                  {/* Canales populares para probar */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-[#121111] dark:text-slate-300 font-heading flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <span>Explora canales populares:</span>
                    </span>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { handle: '@MrBeast', name: 'MrBeast', category: 'Entretenimiento' },
                        { handle: '@midudev', name: 'midudev', category: 'Desarrollo Web' },
                        { handle: '@platzi', name: 'Platzi', category: 'Educación y Tech' },
                        { handle: '@FaztCode', name: 'Fazt Code', category: 'Programación' },
                      ].map((s) => (
                        <button
                          key={s.handle}
                          type="button"
                          onClick={() => handleOpenChannel(s.handle)}
                          className="flex flex-col p-3 rounded-2xl border border-neutral-200/90 bg-white hover:border-purple-300 hover:shadow-xs transition-all text-left dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-purple-700 cursor-pointer"
                        >
                          <span className="text-xs font-bold text-[#121111] dark:text-white truncate">
                            {s.name}
                          </span>
                          <span className="text-[11px] font-mono text-purple-600 dark:text-purple-400">
                            {s.handle}
                          </span>
                          <span className="text-[10px] text-[#5B5B66] dark:text-slate-500 mt-1">
                            {s.category}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Centro Unificado de Descargas */}
          {activeTab === 'downloads' && (
            <DownloadsHubTab
              metadata={metadata}
              transcript={transcript}
              commentsData={commentsData}
              onAnalyzeVideo={handleAnalyze}
              onInspectVideo={(vid) => handleAnalyze(vid, 'downloads')}
              onFetchTranscript={() => fetchTranscriptForVideo(metadata?.videoId || '')}
              onFetchComments={() => fetchCommentsForVideo(metadata?.videoId || '')}
              onOpenSettings={() => setIsSettingsOpen(true)}
              hasApiKey={Boolean(apiKey)}
              isLoadingVideo={isLoading}
            />
          )}

          {/* TAB 5: Listas de Reproducción (Reproducción continua y gestión) */}
          {activeTab === 'playlists' && (
            <PlaylistsTab
              onNavigateToSearch={() => {
                setResetSearchSignal((prev) => prev + 1);
                setActiveTab('search');
              }}
              onOpenVideoWatch={handleOpenWatchVideo}
            />
          )}

          {/* TAB 6: Repurposing con IA (Al final) */}
          {activeTab === 'repurpose' && (
            <div>
              {metadata ? (
                <RepurposingStudioTab
                  metadata={metadata}
                  transcript={transcript}
                  savedDrafts={savedAiDrafts.filter((d) => d.videoId === metadata.videoId)}
                  onSaveToLibrary={handleSaveAiDraft}
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/30 p-8 sm:p-12 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/40 shadow-xs">
                    <Sparkles className="h-7 w-7" />
                  </div>
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <h3 className="text-base font-bold text-[#121111] dark:text-slate-200 font-heading">
                      Repurposing de Contenido con IA
                    </h3>
                    <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                      Selecciona o analiza un video desde el <strong>Buscador</strong> o <strong>Historial</strong> para generar guiones virales de Shorts, hilos de X, posts de LinkedIn y boletines con Gemini.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-xs cursor-pointer"
                  >
                    <Search className="h-4 w-4" />
                    <span>Ir al Buscador de Videos</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: Pestaña Unificada de Favoritos (Canales y Videos) */}
          {activeTab === 'favorites' && (
            <FavoritesTab
              onOpenChannel={handleOpenChannel}
              onOpenVideoWatch={handleOpenWatchVideo}
              onDownloadAudioVideo={(vid) => handleAnalyze(vid, 'downloads')}
              onNavigateToSearch={() => {
                setResetSearchSignal((prev) => prev + 1);
                setActiveTab('search');
              }}
            />
          )}

          {/* TAB 7: Historial (Antes Biblioteca y Guardados, al final de la navegación) */}
          {activeTab === 'history' && (
            <LibraryTab
              videos={savedVideos}
              aiDrafts={savedAiDrafts}
              storageInfo={storageInfo}
              onSelectVideo={handleSelectVideoFromLibrary}
              onOpenVideoWatch={handleOpenWatchVideo}
              onDeleteVideo={handleDeleteVideo}
              onDeleteDraft={handleDeleteDraft}
              onToggleFavorite={async (vid) => {
                await repository.toggleFavorite(vid);
                await refreshLibraryData();
              }}
              onClearAllData={handleClearAllData}
            />
          )}

          {/* TAB 8: Salidas de Prompts (Historial y reportes de IA) */}
          {activeTab === 'outputs' && (
            <PromptOutputsTab
              onOpenVideoWatch={handleOpenWatchVideo}
              onNavigateToSearch={() => setActiveTab('search')}
            />
          )}

          {/* TAB 9: Gestión de Prompts (Almacén centralizado de prompts de IA) */}
          {activeTab === 'prompts' && <PromptManagementTab />}
            </>
          )}
        </main>

        {/* Footer minimalista */}
        <footer className="mt-auto border-t border-neutral-200/80 bg-white py-4 px-6 text-xs text-[#5B5B66] dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-500 transition-colors">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>YouTube Content Toolkit · Almacenamiento local IndexedDB activo</span>
            <span className="text-[#5B5B66] dark:text-slate-400 font-mono text-[11px]">
              Arquitectura lista para Supabase / Firebase
            </span>
          </div>
        </footer>
      </div>

      {/* Modal de Configuración y Clave API */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        theme={theme}
        onChangeTheme={handleChangeTheme}
        autoAnalyze={autoAnalyze}
        onToggleAutoAnalyze={setAutoAnalyze}
      />
    </div>
  );
}
