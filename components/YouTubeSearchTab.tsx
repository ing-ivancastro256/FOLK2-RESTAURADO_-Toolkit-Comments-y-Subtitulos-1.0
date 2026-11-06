'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Loader2,
  Calendar,
  User,
  X,
  AlertCircle,
  SlidersHorizontal,
  Check,
  RotateCcw,
  Clock,
  Eye,
  ArrowUpDown,
  Play,
  Flame,
  Radio,
  MessageSquare,
  ChevronDown,
  Copy,
} from 'lucide-react';
import { YouTubeSearchResultItem } from '@/lib/types';
import { copyTextToClipboard, getYouTubeVideoUrl } from '@/lib/youtube';
import { YouTubeWatchViewer } from '@/components/YouTubeWatchViewer';

interface YouTubeSearchTabProps {
  apiKey?: string;
  hasApiKey: boolean;
  onOpenSettings: () => void;
  initialType?: 'video' | 'short' | 'live' | 'video_and_shorts' | 'channel';
  onAnalyzeVideo?: (videoId: string) => Promise<void>;
  onDownloadAudioVideo?: (videoId: string) => void;
  onOpenChannel?: (channelQuery: string) => void;
  resetSignal?: number; // Señal para salir inmediatamente del reproductor al hacer clic en Buscador
  onFavoriteChanged?: () => void;
}

export interface SearchFiltersState {
  type: 'video' | 'short' | 'live' | 'video_and_shorts' | 'channel' | 'playlist' | 'movie';
  duration: 'all' | 'short' | 'medium' | 'long';
  uploadDate: 'all' | 'today' | 'week' | 'month' | 'year';
  features: string[]; // live, 4k, hd, subtitles, cc, 360, vr180, 3d, hdr, location, shopping
  sortBy: 'relevance' | 'viewCount' | 'commentCount' | 'date' | 'duration_desc' | 'duration_asc';
}

const DEFAULT_FILTERS: SearchFiltersState = {
  type: 'video',
  duration: 'all',
  uploadDate: 'all',
  features: [],
  sortBy: 'relevance',
};

const PAGE_SIZE = 12;

function parseMetricClient(text?: string): number {
  if (!text || text === 'Desactivados') return 0;
  const lower = text.toLowerCase().replace(/\u00a0/g, ' ').trim();
  const isMillions = /(?:^|[\d\s.,])(m|mill|millón|millones)(?:\b|\s|$)/i.test(lower);
  const isThousands = !isMillions && /(?:^|[\d\s.,])(k|mil)(?:\b|\s|$)/i.test(lower);
  const numMatch = lower.match(/([0-9]+(?:[.,][0-9]+)*)/);
  if (!numMatch) return 0;
  if (isMillions || isThousands) {
    const val = parseFloat(numMatch[1].replace(',', '.'));
    return isNaN(val) ? 0 : Math.round(val * (isMillions ? 1000000 : 1000));
  }
  const exact = parseInt(numMatch[1].replace(/[^0-9]/g, ''), 10);
  return isNaN(exact) ? 0 : exact;
}

function parseDurationClient(text?: string): number {
  if (!text) return 0;
  const parts = text.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function sortResultsClient(
  items: YouTubeSearchResultItem[],
  sortBy: SearchFiltersState['sortBy']
): YouTubeSearchResultItem[] {
  if (sortBy === 'relevance' || sortBy === 'date') return items;
  const sorted = [...items];
  const getViews = (v: any) =>
    typeof v.viewsNumber === 'number' ? v.viewsNumber : parseMetricClient(v.viewCountText);
  const getComments = (v: any) =>
    typeof v.commentCountNumber === 'number'
      ? v.commentCountNumber
      : parseMetricClient(v.commentCountText);
  const getDuration = (v: any) =>
    typeof v.durationSeconds === 'number'
      ? v.durationSeconds
      : parseDurationClient(v.durationText);

  if (sortBy === 'viewCount') {
    sorted.sort((a, b) => getViews(b) - getViews(a));
  } else if (sortBy === 'commentCount') {
    sorted.sort((a, b) => getComments(b) - getComments(a) || getViews(b) - getViews(a));
  } else if (sortBy === 'duration_desc') {
    sorted.sort((a, b) => getDuration(b) - getDuration(a));
  } else if (sortBy === 'duration_asc') {
    sorted.sort((a, b) => getDuration(a) - getDuration(b));
  }
  return sorted;
}

function filterFetchedLocally(
  items: YouTubeSearchResultItem[],
  filtersToUse: SearchFiltersState
): YouTubeSearchResultItem[] {
  let fetchedResults = [...items];

  // Filtro local estricto de garantía para Shorts (< 60 segundos)
  if (filtersToUse.type === 'short') {
    fetchedResults = fetchedResults.filter((v) => {
      const isShortBadge =
        v.badges?.includes('Shorts') || v.title.toLowerCase().includes('#shorts');
      if (v.durationText) {
        const parts = v.durationText.split(':').map((p) => parseInt(p, 10));
        if (parts.length === 2) {
          const sec = parts[0] * 60 + parts[1];
          return sec <= 60;
        }
      }
      return isShortBadge;
    });
  }

  // Filtro local estricto para fechas
  if (filtersToUse.uploadDate === 'today') {
    fetchedResults = fetchedResults.filter((v) => {
      const pub = v.publishedAt.toLowerCase();
      return (
        pub.includes('hora') ||
        pub.includes('minuto') ||
        pub.includes('segundo') ||
        pub.includes('hour') ||
        pub.includes('minute') ||
        pub.includes('hoy')
      );
    });
  } else if (filtersToUse.uploadDate === 'week') {
    fetchedResults = fetchedResults.filter((v) => {
      const pub = v.publishedAt.toLowerCase();
      const isMonthOrYear =
        pub.includes('mes') ||
        pub.includes('año') ||
        pub.includes('month') ||
        pub.includes('year');
      if (isMonthOrYear) return false;
      if (pub.includes('semana') || pub.includes('week')) {
        return pub.includes('1 ') || pub.includes('una ');
      }
      return true;
    });
  }

  return fetchedResults;
}

export function YouTubeSearchTab({
  apiKey,
  hasApiKey,
  onOpenSettings,
  initialType,
  onOpenChannel,
  resetSignal,
  onFavoriteChanged,
}: YouTubeSearchTabProps) {
  const [query, setQuery] = useState(
    initialType === 'short'
      ? 'Shorts virales'
      : initialType === 'live'
      ? 'Noticias en vivo'
      : initialType === 'channel'
      ? '@MrBeast'
      : ''
  );
  const [results, setResults] = useState<YouTubeSearchResultItem[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedVideoId, setCopiedVideoId] = useState<string | null>(null);

  const handleCopyCardLink = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    e.preventDefault();
    await copyTextToClipboard(getYouTubeVideoUrl(videoId));
    setCopiedVideoId(videoId);
    setTimeout(() => {
      setCopiedVideoId((prev) => (prev === videoId ? null : prev));
    }, 2000);
  };

  // Video seleccionado para la vista detallada estilo YouTube Watch
  const [selectedVideo, setSelectedVideo] = useState<YouTubeSearchResultItem | null>(null);

  const defaultModeType: SearchFiltersState['type'] = initialType || 'video';

  // Estados de filtros y modal
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFiltersState>({
    ...DEFAULT_FILTERS,
    type: defaultModeType,
  });

  // Salir inmediatamente del reproductor al recibir la señal de clic en "Buscador de videos"
  const [prevResetSignal, setPrevResetSignal] = useState(resetSignal);
  if (resetSignal !== prevResetSignal) {
    setPrevResetSignal(resetSignal);
    if (selectedVideo) {
      setSelectedVideo(null);
    }
  }

  // Sincronizar initialType desde la barra lateral según patrón oficial de React
  const [prevInitialType, setPrevInitialType] = useState(initialType);
  if (initialType !== prevInitialType) {
    setPrevInitialType(initialType);
    setFilters((prev) => ({ ...prev, type: initialType || 'video' }));
    if (initialType === 'short' && !query) {
      setQuery('Shorts virales');
    } else if (initialType === 'live' && !query) {
      setQuery('Noticias en vivo');
    } else if (initialType === 'channel' && !query) {
      setQuery('@MrBeast');
    }
  }

  // Conteo de filtros activos respecto al modo predeterminado de la pestaña
  const activeFiltersCount =
    (filters.type !== defaultModeType ? 1 : 0) +
    (filters.duration !== 'all' ? 1 : 0) +
    (filters.uploadDate !== 'all' ? 1 : 0) +
    filters.features.length +
    (filters.sortBy !== 'relevance' ? 1 : 0);

  // Función principal de búsqueda
  const handleSearch = async (searchTerm?: string, customFilters?: SearchFiltersState) => {
    const term = searchTerm !== undefined ? searchTerm : query;
    if (!term.trim()) return;

    const filtersToUse = customFilters || filters;

    // Si es búsqueda de canal por @handle, URL de canal o modo 'channel'
    if (
      (filtersToUse.type === 'channel' ||
        term.trim().startsWith('@') ||
        term.includes('youtube.com/@') ||
        term.includes('youtube.com/channel/')) &&
      onOpenChannel
    ) {
      onOpenChannel(term.trim());
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setSelectedVideo(null);
    setVisibleCount(PAGE_SIZE);
    setNextPageToken(null);
    setActiveSearchQuery(term.trim());

    try {
      const q = new URLSearchParams({
        q: term.trim(),
        type: filtersToUse.type,
        duration: filtersToUse.duration,
        uploadDate: filtersToUse.uploadDate,
        sortBy: filtersToUse.sortBy,
      });

      if (filtersToUse.features.length > 0) {
        q.set('features', filtersToUse.features.join(','));
      }

      if (apiKey) q.set('apiKey', apiKey);

      const res = await fetch(`/api/youtube/search?${q.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al buscar en YouTube');
      }

      const fetchedResults = sortResultsClient(
        filterFetchedLocally(data.results || [], filtersToUse),
        filtersToUse.sortBy
      );
      setResults(fetchedResults);
      setNextPageToken(data.nextPageToken || null);
    } catch (err: unknown) {
      const errObj = err as Error;
      setError(errObj.message || 'Error en la búsqueda');
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar la siguiente tanda de videos ("Mostrar más")
  const handleLoadMore = async () => {
    if (isLoadingMore) return;

    // Si ya tenemos suficientes resultados almacenados en el buffer local para mostrar otra tanda completa, mostrarlos al instante
    if (results.length >= visibleCount + PAGE_SIZE) {
      setVisibleCount((prev) => prev + PAGE_SIZE);
      return;
    }

    // Si no hay más páginas remotas pero quedan elementos ocultos en el buffer, mostrarlos todos
    if (!nextPageToken) {
      setVisibleCount(results.length);
      return;
    }

    const term = (activeSearchQuery || query).trim();
    if (!term) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const q = new URLSearchParams({
        q: term,
        type: filters.type,
        duration: filters.duration,
        uploadDate: filters.uploadDate,
        sortBy: filters.sortBy,
        pageToken: nextPageToken,
      });

      if (filters.features.length > 0) {
        q.set('features', filters.features.join(','));
      }

      if (apiKey) q.set('apiKey', apiKey);

      const res = await fetch(`/api/youtube/search?${q.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al cargar más videos');
      }

      const incoming = sortResultsClient(
        filterFetchedLocally(data.results || [], filters),
        filters.sortBy
      );
      const existingIds = new Set(results.map((item) => item.id));
      const uniqueNew = incoming.filter((item) => !existingIds.has(item.id));
      const updatedTotal = results.length + uniqueNew.length;

      setResults((prev) => {
        const ids = new Set(prev.map((item) => item.id));
        const merged = [...prev, ...incoming.filter((item) => !ids.has(item.id))];
        return sortResultsClient(merged, filters.sortBy);
      });
      setNextPageToken(data.nextPageToken || null);
      setVisibleCount((prev) => Math.min(Math.min(prev, results.length) + PAGE_SIZE, Math.max(updatedTotal, PAGE_SIZE)));
    } catch (err: unknown) {
      const errObj = err as Error;
      setError(errObj.message || 'Error al cargar más videos');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleToggleFeature = (featureKey: string) => {
    setFilters((prev) => {
      const exists = prev.features.includes(featureKey);
      const newFeatures = exists
        ? prev.features.filter((f) => f !== featureKey)
        : [...prev.features, featureKey];
      return { ...prev, features: newFeatures };
    });
  };

  const handleResetFilters = () => {
    const resetState: SearchFiltersState = {
      ...DEFAULT_FILTERS,
      type: defaultModeType,
    };
    setFilters(resetState);
    if (query.trim()) {
      handleSearch(query, resetState);
    }
  };

  // Cambio de ordenamiento directo desde la barra externa
  const handleChangeSort = (newSort: SearchFiltersState['sortBy']) => {
    const updated = { ...filters, sortBy: newSort };
    setFilters(updated);
    if (query.trim()) {
      handleSearch(query, updated);
    }
  };

  // Cambio de tipo de contenido (Todos, Videos, Shorts, En vivo, Videos y Shorts, Canales)
  const handleChangeType = (newType: SearchFiltersState['type']) => {
    const updated = { ...filters, type: newType };
    setFilters(updated);
    if (query.trim()) {
      handleSearch(query, updated);
    }
  };

  // Si hay un video seleccionado, mostrar la vista individual tipo YouTube Watch
  if (selectedVideo) {
    return (
      <YouTubeWatchViewer
        video={selectedVideo}
        onBackToResults={() => setSelectedVideo(null)}
        apiKey={apiKey}
        onOpenChannel={onOpenChannel}
        onFavoriteChanged={onFavoriteChanged}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Encabezado y Barra de Búsqueda */}
      <div className="rounded-2xl border border-neutral-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#121111] dark:text-slate-100 font-heading">
              {filters.type === 'short'
                ? 'Buscador de YouTube Shorts'
                : filters.type === 'live'
                ? 'Transmisiones en Vivo de YouTube'
                : filters.type === 'channel'
                ? 'Búsqueda por Usuario / Canal'
                : 'Buscador de Videos de YouTube'}
            </h2>
            <p className="text-xs text-[#5B5B66] dark:text-slate-400 mt-1">
              Resultados completos con duración en minutos/segundos y cantidad exacta de visitas. Haz clic en cualquier video para reproducirlo, ver sus etiquetas, descripción completa y comentarios.
            </p>
          </div>

          {/* Selector de Modo Superior: Videos | Shorts | En vivo | Videos y Shorts | Por Canal (@) */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-neutral-100 dark:bg-slate-800/80 rounded-xl border border-neutral-200/60 dark:border-slate-700/60 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => handleChangeType('video')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filters.type === 'video'
                  ? 'bg-white text-[#121111] shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Videos
            </button>

            <button
              type="button"
              onClick={() => handleChangeType('short')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filters.type === 'short'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-[#5B5B66] hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Shorts (&lt; 60s)</span>
            </button>

            {/* Opción EN VIVO integrada directamente */}
            <button
              type="button"
              onClick={() => handleChangeType('live')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filters.type === 'live'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-[#5B5B66] hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              <span>En vivo</span>
            </button>

            <button
              type="button"
              onClick={() => handleChangeType('video_and_shorts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filters.type === 'video_and_shorts'
                  ? 'bg-white text-[#121111] shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Videos y Shorts
            </button>

            <button
              type="button"
              onClick={() => handleChangeType('channel')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filters.type === 'channel'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-[#5B5B66] hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Por Canal (@)</span>
            </button>
          </div>
        </div>

        {/* Formulario de búsqueda con botón de Filtros */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#5B5B66] dark:text-slate-500">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                filters.type === 'short'
                  ? 'Buscar Shorts virales, tendencias, temas...'
                  : filters.type === 'live'
                  ? 'Buscar transmisiones en vivo, directos, noticias...'
                  : filters.type === 'channel'
                  ? 'Buscar usuario por @handle, URL completa o nombre de canal...'
                  : 'Buscar en YouTube por palabra clave, tema o canal...'
              }
              className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-10 pr-10 text-xs sm:text-sm text-[#121111] placeholder-[#5B5B66]/70 focus:border-[#2848F0] focus:outline-none dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-rose-500 shadow-2xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-3.5 text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Botón de Filtros Modal */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
              activeFiltersCount > 0
                ? 'border-[#2848F0] bg-blue-50 text-[#2848F0] dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-300'
                : 'border-neutral-200 bg-white hover:bg-neutral-50 text-[#121111] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filtros</span>
            {activeFiltersCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2848F0] dark:bg-rose-600 text-[11px] font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:shadow-md disabled:opacity-50 transition-all whitespace-nowrap cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Buscando...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Buscar</span>
              </>
            )}
          </button>
        </form>

        {/* 2. BARRA EXTERIOR DE ORDENACIÓN Y FILTROS RÁPIDOS */}
        <div className="pt-2 border-t border-neutral-100 dark:border-slate-800/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Opciones de Ordenamiento Exterior */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[#5B5B66] dark:text-slate-400 font-medium flex items-center gap-1 mr-1">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span>Ordenar por:</span>
              </span>

              {[
                { id: 'relevance', label: 'Relevancia' },
                { id: 'viewCount', label: 'Número de visitas' },
                { id: 'commentCount', label: 'Comentarios' },
                { id: 'date', label: 'Fecha de subida' },
                { id: 'duration_desc', label: 'Duración' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleChangeSort(opt.id as SearchFiltersState['sortBy'])}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    filters.sortBy === opt.id
                      ? 'bg-neutral-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                      : 'bg-neutral-100 text-[#5B5B66] hover:text-[#121111] hover:bg-neutral-200/70 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Restablecer filtros ({activeFiltersCount})</span>
              </button>
            )}
          </div>

          {/* Filtros rápidos complementarios (Fecha de carga y Características útiles, sin repetir la barra superior) */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-medium text-[#5B5B66] dark:text-slate-400">
              Publicado:
            </span>

            {[
              { id: 'today', label: 'Hoy' },
              { id: 'week', label: 'Esta semana' },
              { id: 'month', label: 'Este mes' },
              { id: 'year', label: 'Este año' },
            ].map((f) => {
              const isActive = filters.uploadDate === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    const nextDate = isActive ? 'all' : f.id;
                    const updated = { ...filters, uploadDate: nextDate as SearchFiltersState['uploadDate'] };
                    setFilters(updated);
                    if (query.trim()) handleSearch(query, updated);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                    isActive
                      ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-white text-[#5B5B66] border-neutral-200 hover:bg-neutral-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}

            <span className="text-neutral-300 dark:text-slate-700">|</span>

            <span className="text-[11px] font-medium text-[#5B5B66] dark:text-slate-400">
              Características:
            </span>

            {[
              { id: 'subtitles', label: 'Con subtítulos' },
              { id: '4k', label: '4K' },
              { id: 'hd', label: 'HD' },
              { id: 'cc', label: 'Creative Commons' },
            ].map((feat) => {
              const isActive = filters.features.includes(feat.id);
              return (
                <button
                  key={feat.id}
                  type="button"
                  onClick={() => {
                    const nextFeatures = isActive
                      ? filters.features.filter((x) => x !== feat.id)
                      : [...filters.features, feat.id];
                    const updated = { ...filters, features: nextFeatures };
                    setFilters(updated);
                    if (query.trim()) handleSearch(query, updated);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer font-medium ${
                    isActive
                      ? 'bg-[#2848F0] text-white border-[#2848F0] dark:bg-rose-600 dark:border-rose-600'
                      : 'bg-white text-[#5B5B66] border-neutral-200 hover:bg-neutral-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                  }`}
                >
                  {feat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alerta de error si ocurre */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Estado cargando */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#2848F0] dark:text-rose-500" />
          <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
            Obteniendo videos y métricas exactas...
          </h3>
          <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-sm">
            Consultando duración en minutos y número de vistas en tiempo real.
          </p>
        </div>
      )}

      {/* Estado vacío inicial */}
      {!isLoading && !hasSearched && (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/30 p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-[#5B5B66] dark:text-slate-400 shadow-2xs border border-neutral-200 dark:border-slate-800">
            <Search className="h-6 w-6 text-[#2848F0] dark:text-rose-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
              Buscador completo con duración y visitas garantizadas
            </h3>
            <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md mx-auto">
              Escribe un término o filtra por <strong>Videos</strong>, <strong>Shorts</strong>, <strong>En vivo</strong> o <strong>Videos y Shorts</strong> para ver y reproducir contenido.
            </p>
          </div>
        </div>
      )}

      {/* 3. RESULTADOS DE BÚSQUEDA */}
      {!isLoading && hasSearched && results.length > 0 && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5B5B66] dark:text-slate-400 px-1">
            <span>
              Mostrando <strong className="text-[#121111] dark:text-white font-mono">{Math.min(visibleCount, results.length)}</strong>{' '}
              {filters.type === 'short' ? 'Shorts' : filters.type === 'live' ? 'transmisiones en vivo' : 'videos'}
            </span>
            <span className="text-[11px] text-[#2848F0] dark:text-rose-400 font-medium">
              Haz clic en cualquier video para reproducirlo, ver sus etiquetas, descripción completa y analizar sus comentarios
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.slice(0, visibleCount).map((video) => {
              const isShort =
                video.badges?.includes('Shorts') ||
                video.title.toLowerCase().includes('#shorts') ||
                (video.durationText && video.durationText.length <= 4 && video.durationText.startsWith('0:'));
              const isLive =
                video.badges?.some((b) => b.toLowerCase().includes('vivo') || b.toLowerCase().includes('live')) ||
                video.title.toLowerCase().includes('en vivo');

              return (
                <div
                  key={video.id}
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                    }
                    setSelectedVideo(video);
                  }}
                  className="group flex flex-col rounded-2xl border border-neutral-200/90 bg-white overflow-hidden shadow-xs hover:shadow-md transition-all hover:border-neutral-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 cursor-pointer"
                >
                  {/* Miniatura con duración destacada */}
                  <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Botón de reproducción en hover */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-[#121111] shadow-lg backdrop-blur-xs">
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </div>
                    </div>

                    {/* Badge de Shorts o En Vivo en esquina superior izquierda */}
                    {isShort ? (
                      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        <Flame className="h-3 w-3 fill-current" />
                        <span>SHORTS</span>
                      </div>
                    ) : isLive ? (
                      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        <Radio className="h-3 w-3 animate-pulse" />
                        <span>EN VIVO</span>
                      </div>
                    ) : null}

                    {/* Botón Copiar enlace en esquina superior derecha de cada video */}
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

                    {/* DURACIÓN VISIBLE SIEMPRE */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                      <span className="rounded-md bg-black/85 px-2 py-0.5 text-[11px] font-mono font-bold text-white backdrop-blur-xs shadow-xs">
                        {video.durationText || (isShort ? '0:45' : '03:15')}
                      </span>
                    </div>
                  </div>

                  {/* Contenido de la tarjeta */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <h3
                        className="text-xs sm:text-sm font-bold text-[#121111] dark:text-slate-100 font-heading line-clamp-2 leading-snug group-hover:text-[#2848F0] dark:group-hover:text-rose-400 transition-colors"
                        title={video.title}
                      >
                        {video.title}
                      </h3>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenChannel) onOpenChannel(video.channelTitle);
                        }}
                        className="flex items-center gap-1.5 text-xs text-[#5B5B66] hover:text-[#2848F0] dark:text-slate-400 dark:hover:text-rose-400 font-semibold group/ch transition-colors cursor-pointer text-left"
                        title={onOpenChannel ? `Ver canal y todos los videos de ${video.channelTitle}` : undefined}
                      >
                        <User className="h-3.5 w-3.5 shrink-0 text-[#2848F0] dark:text-rose-400" />
                        <span className="truncate group-hover/ch:underline">{video.channelTitle}</span>
                        {onOpenChannel && (
                          <span className="text-[10px] text-[#5B5B66]/70 dark:text-slate-500 font-normal">
                            · Ver canal
                          </span>
                        )}
                      </button>

                      {/* DATOS DE VISITAS, COMENTARIOS, DURACIÓN Y FECHA */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-mono pt-1 text-[#5B5B66] dark:text-slate-400">
                        <span className="flex items-center gap-1 font-semibold text-[#121111] dark:text-slate-200">
                          <Eye className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-400" />
                          <span>{video.viewCountText || '15 K vistas'}</span>
                        </span>

                        {video.commentCountText !== undefined && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold ${
                              video.commentsDisabled || video.commentCountText === 'Desactivados'
                                ? 'bg-neutral-100 text-neutral-500 dark:bg-slate-800 dark:text-slate-400'
                                : video.commentCountText === '0'
                                ? 'bg-neutral-100 text-[#5B5B66] dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-blue-50 text-[#2848F0] border border-blue-200/70 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60'
                            }`}
                            title={
                              video.commentsDisabled || video.commentCountText === 'Desactivados'
                                ? 'Comentarios desactivados en este video'
                                : `${video.commentCountText} comentarios disponibles`
                            }
                          >
                            <MessageSquare className="h-3 w-3 shrink-0" />
                            <span>
                              {video.commentsDisabled || video.commentCountText === 'Desactivados'
                                ? 'Desactivados'
                                : `${video.commentCountText} comentarios`}
                            </span>
                          </span>
                        )}

                        <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{video.durationText || (isShort ? '0:45 min' : '03:15 min')}</span>
                        </span>

                        {video.publishedAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{video.publishedAt}</span>
                          </span>
                        )}
                      </div>

                      {video.description && (
                        <p className="text-[11px] text-[#5B5B66] dark:text-slate-400 line-clamp-2 leading-relaxed pt-0.5">
                          {video.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-neutral-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-[#2848F0] dark:text-rose-400 font-bold">
                      <span>Ver ficha, tags y comentarios</span>
                      <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botón Mostrar más para cargar la siguiente tanda de videos */}
          {(visibleCount < results.length || Boolean(nextPageToken)) && (
            <div className="flex flex-col items-center justify-center pt-4 pb-2 space-y-2">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-[#2848F0] text-[#121111] hover:text-[#2848F0] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:border-rose-500 dark:hover:text-rose-400 px-8 py-3.5 text-xs sm:text-sm font-bold shadow-xs hover:shadow-md disabled:opacity-60 transition-all cursor-pointer"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#2848F0] dark:text-rose-400" />
                    <span>Cargando más videos...</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 text-[#2848F0] dark:text-rose-400" />
                    <span>Mostrar más</span>
                  </>
                )}
              </button>
              <span className="text-[11px] text-[#5B5B66] dark:text-slate-500">
                Mostrando {Math.min(visibleCount, results.length)} videos · Haz clic para cargar otra tanda
              </span>
            </div>
          )}
        </div>
      )}

      {/* Estado sin resultados */}
      {!isLoading && hasSearched && results.length === 0 && !error && (
        <div className="py-14 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-slate-800 space-y-3">
          <p className="text-sm font-semibold text-[#121111] dark:text-slate-300">
            No se encontraron {filters.type === 'short' ? 'Shorts' : filters.type === 'live' ? 'transmisiones en vivo' : 'videos'} para &quot;{query}&quot; con los filtros actuales.
          </p>
          <p className="text-xs text-[#5B5B66] dark:text-slate-500 max-w-sm mx-auto">
            Prueba seleccionando <strong>Videos y Shorts</strong> o ampliando la fecha de carga.
          </p>
          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-[#121111] dark:text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restablecer filtros</span>
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DE FILTROS DE BÚSQUEDA */}
      {/* ======================================================== */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6">
            {/* Header del modal */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="h-5 w-5 text-[#2848F0] dark:text-rose-500" />
                <h3 className="text-lg font-bold text-[#121111] dark:text-white font-heading">
                  Filtros de búsqueda
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="flex items-center justify-center h-8 w-8 rounded-full text-[#5B5B66] hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cuadrícula de 5 Columnas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 text-xs">
              {/* Columna 1: TIPO */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold tracking-wider text-[#5B5B66] dark:text-slate-400 uppercase block pb-1 border-b border-neutral-100 dark:border-slate-800">
                  TIPO
                </span>
                <div className="space-y-2">
                  {[
                    { id: 'video', label: 'Videos' },
                    { id: 'short', label: 'Shorts (< 60s)' },
                    { id: 'live', label: 'En vivo' },
                    { id: 'video_and_shorts', label: 'Videos y Shorts' },
                    { id: 'channel', label: 'Canales' },
                    { id: 'playlist', label: 'Playlists' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilters({ ...filters, type: item.id as any })}
                      className={`w-full text-left py-1 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        filters.type === item.id
                          ? 'font-bold text-[#121111] dark:text-white'
                          : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>{item.label}</span>
                      {filters.type === item.id && <Check className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-500" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Columna 2: DURACIÓN */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold tracking-wider text-[#5B5B66] dark:text-slate-400 uppercase block pb-1 border-b border-neutral-100 dark:border-slate-800">
                  DURACIÓN
                </span>
                <div className="space-y-2">
                  {[
                    { id: 'all', label: 'Cualquiera' },
                    { id: 'short', label: 'Inferior a 3 minutos' },
                    { id: 'medium', label: 'De 3 a 20 minutos' },
                    { id: 'long', label: 'Más de 20 minutos' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilters({ ...filters, duration: item.id as any })}
                      className={`w-full text-left py-1 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        filters.duration === item.id
                          ? 'font-bold text-[#121111] dark:text-white'
                          : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>{item.label}</span>
                      {filters.duration === item.id && <Check className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-500" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Columna 3: FECHA DE CARGA */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold tracking-wider text-[#5B5B66] dark:text-slate-400 uppercase block pb-1 border-b border-neutral-100 dark:border-slate-800">
                  FECHA DE CARGA
                </span>
                <div className="space-y-2">
                  {[
                    { id: 'all', label: 'Cualquier fecha' },
                    { id: 'today', label: 'Hoy' },
                    { id: 'week', label: 'Esta semana' },
                    { id: 'month', label: 'Este mes' },
                    { id: 'year', label: 'Este año' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilters({ ...filters, uploadDate: item.id as any })}
                      className={`w-full text-left py-1 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        filters.uploadDate === item.id
                          ? 'font-bold text-[#121111] dark:text-white'
                          : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>{item.label}</span>
                      {filters.uploadDate === item.id && <Check className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-500" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Columna 4: CARACTERÍSTICAS */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold tracking-wider text-[#5B5B66] dark:text-slate-400 uppercase block pb-1 border-b border-neutral-100 dark:border-slate-800">
                  CARACTERÍSTICAS
                </span>
                <div className="space-y-2">
                  {[
                    { id: 'live', label: 'En vivo' },
                    { id: '4k', label: '4K' },
                    { id: 'hd', label: 'HD' },
                    { id: 'subtitles', label: 'Subtítulos' },
                    { id: 'cc', label: 'Creative Commons' },
                    { id: '360', label: '360°' },
                    { id: 'vr180', label: 'VR180' },
                    { id: '3d', label: '3D' },
                    { id: 'hdr', label: 'HDR' },
                    { id: 'location', label: 'Ubicación' },
                    { id: 'shopping', label: 'Compras' },
                  ].map((item) => {
                    const isSelected = filters.features.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggleFeature(item.id)}
                        className={`w-full text-left py-1 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'font-bold text-[#121111] dark:text-white'
                            : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Columna 5: PRIORIDAD */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold tracking-wider text-[#5B5B66] dark:text-slate-400 uppercase block pb-1 border-b border-neutral-100 dark:border-slate-800">
                  PRIORIDAD
                </span>
                <div className="space-y-2">
                  {[
                    { id: 'relevance', label: 'Relevancia' },
                    { id: 'viewCount', label: 'Número de visitas' },
                    { id: 'commentCount', label: 'Comentarios' },
                    { id: 'date', label: 'Fecha de subida' },
                    { id: 'duration_desc', label: 'Duración' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilters({ ...filters, sortBy: item.id as any })}
                      className={`w-full text-left py-1 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        filters.sortBy === item.id
                          ? 'font-bold text-[#121111] dark:text-white'
                          : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>{item.label}</span>
                      {filters.sortBy === item.id && <Check className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-500" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-neutral-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 px-4 py-2.5 text-xs font-semibold text-[#5B5B66] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restablecer todos los filtros</span>
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="w-full sm:w-auto rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 px-5 py-2.5 text-xs font-semibold text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFilterModalOpen(false);
                    if (query.trim()) {
                      handleSearch(query, filters);
                    }
                  }}
                  className="w-full sm:w-auto rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-6 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Aplicar filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
