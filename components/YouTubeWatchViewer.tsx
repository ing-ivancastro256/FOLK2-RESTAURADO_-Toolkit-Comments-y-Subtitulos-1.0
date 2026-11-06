'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  Calendar,
  Clock,
  Eye,
  User,
  Tag,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Download,
  ThumbsUp,
  Loader2,
  FileText,
  FileSpreadsheet,
  FileCode,
  CheckSquare,
  Square,
  CornerDownRight,
  ExternalLink,
  Star,
  ListPlus,
  ListMusic,
  Plus,
  CheckCircle2,
  X,
  Sparkles,
  AlertTriangle,
  Cpu,
} from 'lucide-react';
import {
  YouTubeSearchResultItem,
  YouTubeCommentItem,
  VideoCommentsData,
  YouTubeVideoMetadata,
  UserPlaylist,
  PlaylistItem,
  PauAnalysisResult,
  PauCommentsLimit,
  PromptExecutionRecord,
} from '@/lib/types';
import { getContentRepository } from '@/lib/repository';
import { copyTextToClipboard, getYouTubeVideoUrl } from '@/lib/youtube';
import { PauDetectorModal } from './PauDetectorModal';
import { PauContinuousView } from './PauContinuousView';
import { AVAILABLE_GEMINI_MODELS, AvailableGeminiModelId } from '@/lib/pau-prompt';

interface YouTubeWatchViewerProps {
  video: YouTubeSearchResultItem;
  onBackToResults: () => void;
  apiKey?: string;
  onOpenChannel?: (channelQuery: string) => void;
  onFavoriteChanged?: () => void;
}

// Función auxiliar para formatear texto de descripción con enlaces interactivos
function renderFormattedDescription(text: string) {
  if (!text) return 'Sin descripción detallada disponible para este video.';

  // Expresión regular para detectar URLs (http, https, www)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 font-sans leading-relaxed text-xs text-[#5B5B66] dark:text-slate-300 select-text">
      {lines.map((line, lineIdx) => {
        if (!line.trim()) {
          return <div key={lineIdx} className="h-2" />;
        }

        const parts = line.split(urlRegex);

        return (
          <p key={lineIdx} className="break-words">
            {parts.map((part, partIdx) => {
              if (part.match(urlRegex)) {
                const href = part.startsWith('www.') ? `https://${part}` : part;
                return (
                  <a
                    key={partIdx}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2848F0] dark:text-rose-400 font-medium hover:underline inline-flex items-center gap-0.5 mx-0.5 cursor-pointer"
                  >
                    <span>{part}</span>
                    <ExternalLink className="h-2.5 w-2.5 inline-block opacity-70" />
                  </a>
                );
              }

              // Detectar timestamps como 02:15 o 1:20:45
              const timestampRegex = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
              if (timestampRegex.test(part)) {
                const subParts = part.split(timestampRegex);
                return (
                  <span key={partIdx}>
                    {subParts.map((sub, sIdx) => {
                      if (sub.match(timestampRegex)) {
                        return (
                          <span
                            key={sIdx}
                            className="text-[#2848F0] dark:text-rose-400 font-mono font-semibold mx-0.5"
                          >
                            {sub}
                          </span>
                        );
                      }
                      return sub;
                    })}
                  </span>
                );
              }

              return part;
            })}
          </p>
        );
      })}
    </div>
  );
}

export function YouTubeWatchViewer({
  video,
  onBackToResults,
  apiKey,
  onOpenChannel,
  onFavoriteChanged,
}: YouTubeWatchViewerProps) {
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [copiedTags, setCopiedTags] = useState(false);
  const [copiedVideoLink, setCopiedVideoLink] = useState(false);

  // Metadatos profundos (trae la descripción original íntegra y tags completos de YouTube)
  const [fullMetadata, setFullMetadata] = useState<YouTubeVideoMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

  // Estados de comentarios reales del video actual
  const [comments, setComments] = useState<YouTubeCommentItem[]>([]);
  const [commentSort, setCommentSort] = useState<'top' | 'newest' | 'oldest'>('top');
  const [totalCommentsReported, setTotalCommentsReported] = useState<number>(0);
  const [commentsDisabled, setCommentsDisabled] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [selectedCommentIds, setSelectedCommentIds] = useState<Set<string>>(new Set());

  // Hilos de respuestas expandidos (set de comment IDs)
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Set<string>>(new Set());

  // Estado del menú de descarga de comentarios
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  // Estados de Favoritos
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [favoriteToast, setFavoriteToast] = useState<string | null>(null);

  // Estados de Modal para Añadir a Listas de Reproducción
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingNewPlaylist, setIsCreatingNewPlaylist] = useState(false);
  const [playlistToast, setPlaylistToast] = useState<string | null>(null);

  // Estados para el Detector de Problemas Urgentes PAU (IA)
  const [pauLimit, setPauLimit] = useState<PauCommentsLimit>(100);
  const [selectedGeminiModel, setSelectedGeminiModel] = useState<AvailableGeminiModelId>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pau_preferred_model') as AvailableGeminiModelId;
      if (stored && AVAILABLE_GEMINI_MODELS.some((m) => m.id === stored)) {
        return stored;
      }
    }
    return 'gemini-3.8-flash';
  });
  const [isAnalyzingPau, setIsAnalyzingPau] = useState(false);
  const [pauError, setPauError] = useState<string | null>(null);

  // Estados de Confirmación previa y Decisión Post-Análisis
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [previousAnalysisInfo, setPreviousAnalysisInfo] = useState<{ dateText: string } | null>(null);
  const [showPostAnalysisModal, setShowPostAnalysisModal] = useState(false);
  const [isViewingPauResults, setIsViewingPauResults] = useState(false);
  const [pauToastMessage, setPauToastMessage] = useState<string | null>(null);

  const showPauToast = (msg: string) => {
    setPauToastMessage(msg);
    setTimeout(() => setPauToastMessage(null), 3000);
  };

  const handleSelectModel = (modelId: AvailableGeminiModelId) => {
    setSelectedGeminiModel(modelId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pau_preferred_model', modelId);
    }
  };
  const [pauResult, setPauResult] = useState<PauAnalysisResult | null>(() => {
    if (video.id && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`pau_analysis_${video.id}`);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // ignore
        }
      }
    }
    return null;
  });
  const [isPauModalOpen, setIsPauModalOpen] = useState(false);

  // Sincronizar análisis si cambia el video actual
  const [prevVideoIdForPau, setPrevVideoIdForPau] = useState(video.id);
  if (video.id !== prevVideoIdForPau) {
    setPrevVideoIdForPau(video.id);
    let loaded: PauAnalysisResult | null = null;
    if (video.id && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`pau_analysis_${video.id}`);
      if (stored) {
        try {
          loaded = JSON.parse(stored);
        } catch {}
      }
    }
    setPauResult(loaded);
    setIsViewingPauResults(false);
    setCommentSort('top');
  }

  // Posicionar siempre arriba en el reproductor al abrir o cambiar de video
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [video.id, isViewingPauResults]);

  // Comprobar análisis previo y abrir modal de confirmación
  const handleRequestPauAnalysis = async () => {
    try {
      const repo = getContentRepository();
      const prev = await repo.getPromptOutputsByVideo(video.id);
      if (prev && prev.length > 0) {
        setPreviousAnalysisInfo({
          dateText: new Date(prev[0].createdAt).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        });
      } else {
        setPreviousAnalysisInfo(null);
      }
    } catch {
      setPreviousAnalysisInfo(null);
    }
    setIsConfirmModalOpen(true);
  };

  const handleRunPauAnalysis = async () => {
    setIsConfirmModalOpen(false);
    setIsAnalyzingPau(true);
    setPauError(null);

    try {
      let commentsToAnalyze = comments;
      const desiredMax = pauLimit === 'all' ? 1500 : pauLimit;
      const needsMoreFromServer =
        commentsToAnalyze.length === 0 ||
        (commentsToAnalyze.length < desiredMax && totalCommentsReported > commentsToAnalyze.length);

      if (needsMoreFromServer) {
        const resComments = await fetch(
          `/api/youtube/comments?videoId=${encodeURIComponent(video.id)}&max=${desiredMax}${
            apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''
          }`
        );
        const dataComments = await resComments.json();
        if (dataComments.comments && dataComments.comments.length > 0) {
          commentsToAnalyze = dataComments.comments;
          setComments(dataComments.comments);
          setSelectedCommentIds(new Set(dataComments.comments.map((c: YouTubeCommentItem) => c.id)));
        } else if (commentsToAnalyze.length === 0) {
          throw new Error(
            'No hay comentarios disponibles para este video o están desactivados por el creador.'
          );
        }
      }

      let customPrompt: string | undefined = undefined;
      if (typeof window !== 'undefined') {
        const storedPrompt = localStorage.getItem('pau_detector_prompt');
        if (storedPrompt && storedPrompt.trim().length > 50) {
          customPrompt = storedPrompt;
        }
      }

      const payload = {
        comments: commentsToAnalyze.map((c) => ({
          id: c.id,
          text: c.text,
          authorName: c.authorName,
          likeCount: c.likeCount,
        })),
        customPrompt,
        limit: pauLimit,
        selectedModel: selectedGeminiModel,
        videoTitle: fullMetadata?.title || video.title,
        videoId: video.id,
      };

      const res = await fetch('/api/gemini/analyze-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ocurrió un error al analizar los comentarios con Gemini.');
      }

      setPauResult(data.data);
      if (typeof window !== 'undefined') {
        localStorage.setItem(`pau_analysis_${video.id}`, JSON.stringify(data.data));
      }

      // Guardar el registro en IndexedDB (Salidas prompt)
      try {
        const record: PromptExecutionRecord = {
          id: `output-${Date.now()}`,
          promptId: 'prompt-pau-default',
          promptName: 'Detector de Problemas Urgentes PAU',
          videoId: video.id,
          videoTitle: fullMetadata?.title || video.title,
          channelTitle: fullMetadata?.channelTitle || video.channelTitle,
          thumbnailUrl: fullMetadata?.thumbnails?.mq?.url || fullMetadata?.thumbnails?.default?.url || video.thumbnailUrl || `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`,
          modelUsed: data.modelUsed || selectedGeminiModel,
          commentsCount: data.data.meta?.comentarios_analizados || commentsToAnalyze.length,
          commentsSelectedQty: pauLimit,
          result: data.data,
          createdAt: Date.now(),
        };
        await getContentRepository().savePromptOutput(record);
      } catch (saveErr) {
        console.warn('Error al guardar en historial de Salidas prompt:', saveErr);
      }

      setShowPostAnalysisModal(true);
    } catch (err: any) {
      console.error('Error al analizar PAU:', err);
      setPauError(err.message || 'Error inesperado al conectar con Gemini.');
    } finally {
      setIsAnalyzingPau(false);
    }
  };

  // Cargar estado inicial de favorito
  useEffect(() => {
    let isMounted = true;
    const repo = getContentRepository();
    void repo.isFavoriteVideo(video.id).then((fav) => {
      if (isMounted) setIsFavorite(fav);
    });
    return () => {
      isMounted = false;
    };
  }, [video.id]);

  // Manejar alternar favorito
  const handleToggleFavorite = async () => {
    setIsSavingFavorite(true);
    try {
      const repo = getContentRepository();
      const newStatus = await repo.saveFavoriteVideo(fullMetadata || video);
      setIsFavorite(newStatus);
      const msg = newStatus ? '¡Video añadido a tus Favoritos!' : 'Video eliminado de Favoritos';
      setFavoriteToast(msg);
      if (onFavoriteChanged) onFavoriteChanged();
      setTimeout(() => setFavoriteToast(null), 3500);
    } catch {
      // Manejo silencioso
    } finally {
      setIsSavingFavorite(false);
    }
  };

  // Manejar apertura y adición a lista de reproducción
  const handleOpenPlaylistModal = async () => {
    try {
      const repo = getContentRepository();
      const list = await repo.getAllPlaylists();
      setUserPlaylists(list);
      if (list.length > 0) {
        setSelectedPlaylistId(list[0].id);
      }
      setIsPlaylistModalOpen(true);
    } catch {
      // Manejo silencioso
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    try {
      const repo = getContentRepository();
      const item: PlaylistItem = {
        id: video.id,
        title: fullMetadata?.title || video.title,
        channelTitle: fullMetadata?.channelTitle || video.channelTitle,
        thumbnailUrl: video.thumbnailUrl || fullMetadata?.thumbnails?.hq?.url || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
        durationText: video.durationText || fullMetadata?.duration,
        durationSeconds: fullMetadata?.durationSeconds,
      };
      await repo.addVideoToPlaylist(playlistId, item);
      const targetPl = userPlaylists.find((p) => p.id === playlistId);
      setPlaylistToast(`¡Añadido a "${targetPl?.name || 'la lista'}"!`);
      setIsPlaylistModalOpen(false);
      setTimeout(() => setPlaylistToast(null), 3500);
    } catch {
      // error
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    try {
      const repo = getContentRepository();
      const created = await repo.createPlaylist(newPlaylistName.trim(), 'Lista personalizada');
      await handleAddToPlaylist(created.id);
      setNewPlaylistName('');
      setIsCreatingNewPlaylist(false);
    } catch {
      // error
    }
  };

  // 1. Cargar metadatos completos y descripción real de YouTube
  useEffect(() => {
    let isMounted = true;

    const loadFullMetadata = async () => {
      try {
        const q = new URLSearchParams({ videoId: video.id });
        if (apiKey) q.set('apiKey', apiKey);

        const res = await fetch(`/api/youtube/metadata?${q.toString()}`);
        if (res.ok) {
          const data: YouTubeVideoMetadata = await res.json();
          if (isMounted && data) {
            setFullMetadata(data);
          }
        }
      } catch {
        // Fallback al video de búsqueda
      } finally {
        if (isMounted) setIsLoadingMetadata(false);
      }
    };

    void loadFullMetadata();

    return () => {
      isMounted = false;
    };
  }, [video.id, apiKey]);

  // 2. Cargar comentarios reales del video seleccionado (sin usar comentarios de muestra ni de otros videos)
  useEffect(() => {
    let isMounted = true;
    const currentVideoId = video.id;

    setIsLoadingComments(true);
    setComments([]);
    setTotalCommentsReported(0);
    setCommentsDisabled(false);
    setCommentsError(null);
    setSelectedCommentIds(new Set());
    setExpandedReplyThreads(new Set());

    const loadComments = async () => {
      try {
        const q = new URLSearchParams({
          videoId: currentVideoId,
          max: '300',
          sort: commentSort,
        });
        if (apiKey) q.set('apiKey', apiKey);

        const res = await fetch(`/api/youtube/comments?${q.toString()}`, {
          cache: 'no-store',
        });
        const data: VideoCommentsData & { commentsDisabled?: boolean; error?: string } =
          await res.json();

        if (!isMounted) return;
        if (data.videoId && data.videoId !== currentVideoId) return;

        if (data.commentsDisabled) {
          setCommentsDisabled(true);
          setComments([]);
          setSelectedCommentIds(new Set());
          return;
        }

        if (!res.ok) {
          setCommentsError(data.error || 'No se pudieron obtener los comentarios de este video.');
          setComments([]);
          setSelectedCommentIds(new Set());
          return;
        }

        const fetchedList = Array.isArray(data.comments) ? data.comments : [];
        setComments(fetchedList);
        setTotalCommentsReported(data.totalResults || fetchedList.length);
        setSelectedCommentIds(new Set(fetchedList.map((c) => c.id)));
      } catch {
        if (!isMounted) return;
        setCommentsError('Error de conexión al consultar los comentarios de este video.');
        setComments([]);
        setSelectedCommentIds(new Set());
      } finally {
        if (isMounted) setIsLoadingComments(false);
      }
    };

    void loadComments();

    return () => {
      isMounted = false;
    };
  }, [video.id, apiKey, commentSort]);

  // Selección individual de comentario
  const handleToggleSelectComment = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Selección total
  const handleToggleSelectAll = () => {
    if (selectedCommentIds.size === comments.length) {
      setSelectedCommentIds(new Set());
    } else {
      setSelectedCommentIds(new Set(comments.map((c) => c.id)));
    }
  };

  // Alternar expansión de respuestas
  const handleToggleReplies = (commentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedReplyThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  // Etiquetas a mostrar: preferir las extraídas completas por metadata de YouTube
  const displayTags =
    (fullMetadata?.tags && fullMetadata.tags.length > 0)
      ? fullMetadata.tags
      : (video.badges && video.badges.length > 0)
      ? video.badges
      : [];

  const handleCopyTags = () => {
    if (displayTags.length === 0) return;
    void copyTextToClipboard(displayTags.join(', '));
    setCopiedTags(true);
    setTimeout(() => setCopiedTags(false), 2000);
  };

  const handleCopyVideoLink = async () => {
    const url = getYouTubeVideoUrl(video.id);
    await copyTextToClipboard(url);
    setCopiedVideoLink(true);
    setTimeout(() => setCopiedVideoLink(false), 2000);
  };

  // Descripción real completa: preferir la original extraída directamente del video de YouTube
  const descriptionText =
    fullMetadata?.description?.trim() ||
    video.description?.trim() ||
    'Sin descripción detallada para este video.';

  // Descargas en formatos: TXT, CSV, JSON (INCLUYENDO RESPUESTAS)
  const handleDownload = (format: 'txt' | 'csv' | 'json') => {
    const selectedList = comments.filter((c) => selectedCommentIds.has(c.id));
    if (selectedList.length === 0) return;

    let content = '';
    let mimeType = 'text/plain;charset=utf-8';
    let extension = 'txt';
    const cleanTitle = (fullMetadata?.title || video.title).replace(/[\\/:*?"<>|]/g, '').slice(0, 40);

    let totalRepliesIncluded = 0;
    selectedList.forEach((c) => {
      totalRepliesIncluded += c.replies?.length || 0;
    });

    if (format === 'txt') {
      extension = 'txt';
      mimeType = 'text/plain;charset=utf-8';
      content = `COMENTARIOS Y RESPUESTAS DE YOUTUBE: ${video.title}\nCanal: ${video.channelTitle}\nURL: https://www.youtube.com/watch?v=${video.id}\nComentarios principales: ${selectedList.length}\nRespuestas incluidas: ${totalRepliesIncluded}\n${'='.repeat(70)}\n\n`;

      selectedList.forEach((c, idx) => {
        content += `[COMENTARIO #${idx + 1}] ${c.authorName} (${c.publishedAt}) - ${c.likeCount} Likes\n`;
        content += `${c.text}\n`;

        if (c.replies && c.replies.length > 0) {
          content += `  └── RESPUESTAS (${c.replies.length}):\n`;
          c.replies.forEach((r, rIdx) => {
            content += `      (${rIdx + 1}) [${r.authorName} - ${r.publishedAt} - ${r.likeCount} Likes]:\n`;
            content += `          ${r.text}\n`;
          });
        }
        content += `${'-'.repeat(60)}\n\n`;
      });
    } else if (format === 'csv') {
      extension = 'csv';
      mimeType = 'text/csv;charset=utf-8';
      content = '\uFEFF"Tipo","ID","ID_Padre","Autor","Likes","Fecha","Respuestas_Total","Texto"\n';
      selectedList.forEach((c) => {
        const safeText = c.text.replace(/"/g, '""').replace(/\n/g, ' ');
        const safeAuthor = c.authorName.replace(/"/g, '""');
        content += `"Comentario","${c.id}","","${safeAuthor}",${c.likeCount},"${c.publishedAt}",${c.replyCount || 0},"${safeText}"\n`;

        if (c.replies && c.replies.length > 0) {
          c.replies.forEach((r) => {
            const rSafeText = r.text.replace(/"/g, '""').replace(/\n/g, ' ');
            const rSafeAuthor = r.authorName.replace(/"/g, '""');
            content += `"Respuesta","${r.id}","${c.id}","${rSafeAuthor}",${r.likeCount},"${r.publishedAt}",0,"${rSafeText}"\n`;
          });
        }
      });
    } else if (format === 'json') {
      extension = 'json';
      mimeType = 'application/json;charset=utf-8';
      const exportData = {
        videoTitle: fullMetadata?.title || video.title,
        videoId: video.id,
        channel: fullMetadata?.channelTitle || video.channelTitle,
        exportedAt: new Date().toISOString(),
        totalCommentsSelected: selectedList.length,
        totalRepliesIncluded,
        comments: selectedList,
      };
      content = JSON.stringify(exportData, null, 2);
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comentarios-y-respuestas-${cleanTitle}.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setIsDownloadMenuOpen(false);
    setDownloadSuccessMessage(
      `¡Descargados ${selectedList.length} comentarios y ${totalRepliesIncluded} respuestas en formato .${extension.toUpperCase()}!`
    );
    setTimeout(() => setDownloadSuccessMessage(null), 4000);
  };

  const isAllSelected = comments.length > 0 && selectedCommentIds.size === comments.length;

  if (isViewingPauResults && pauResult) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <PauContinuousView
          result={pauResult}
          videoTitle={fullMetadata?.title || video.title}
          videoId={video.id}
          onBack={() => setIsViewingPauResults(false)}
          backButtonText="Volver al video y comentarios"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Barra de Navegación "Atrás a resultados" */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToResults}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 px-4 py-2 text-xs font-bold text-[#121111] dark:text-slate-100 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver a los resultados de búsqueda</span>
        </button>

        <a
          href={`https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <span>Abrir en YouTube</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* 2. REPRODUCTOR CENTRAL PRINCIPAL (Aspecto 16:9 con soporte fullscreen) */}
      <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-neutral-200 dark:border-slate-800 shadow-md">
        <iframe
          src={`https://www.youtube.com/embed/${video.id}?autoplay=1&enablejsapi=1&rel=0`}
          title={fullMetadata?.title || video.title}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {/* 3. INFORMACIÓN DEL VIDEO (Título, Canal, Métricas) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[#121111] dark:text-white font-heading leading-tight flex-1">
            {fullMetadata?.title || video.title}
          </h1>

          {/* Botones de acción solicitados: Favorito al costado del nombre y Añadir a Lista */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={isSavingFavorite}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                isFavorite
                  ? 'bg-amber-500 text-white hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-600 shadow-amber-500/20'
                  : 'bg-white hover:bg-neutral-50 text-[#121111] border border-neutral-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800'
              }`}
              title={isFavorite ? 'Quitar de Favoritos' : 'Agregar a tus videos favoritos'}
            >
              <Star className={`h-4 w-4 ${isFavorite ? 'fill-current text-white' : 'text-amber-500'}`} />
              <span>{isFavorite ? 'En Favoritos' : 'Agregar a Favoritos'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPlaylistModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 text-xs font-semibold text-[#5B5B66] hover:text-[#121111] dark:text-slate-300 dark:hover:text-white transition-colors shadow-2xs cursor-pointer"
              title="Añadir este video a una lista de reproducción continua"
            >
              <ListPlus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Añadir a Lista</span>
            </button>
          </div>
        </div>

        {/* Notificaciones interactivas de Favorito o Lista */}
        {favoriteToast && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2 animate-in fade-in duration-200 shadow-2xs">
            <Star className="h-4 w-4 fill-current text-amber-500 shrink-0" />
            <span>{favoriteToast}</span>
          </div>
        )}

        {playlistToast && (
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-2 animate-in fade-in duration-200 shadow-2xs">
            <CheckCircle2 className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>{playlistToast}</span>
          </div>
        )}

        {/* Fila del canal y estadísticas (visitas, duración, fecha de publicación y copiar enlace al final) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-200/80 dark:border-slate-800/80">
          <div
            onClick={() => onOpenChannel && onOpenChannel(fullMetadata?.channelTitle || video.channelTitle)}
            className={`flex items-center gap-3 ${onOpenChannel ? 'cursor-pointer group' : ''}`}
            title={onOpenChannel ? `Ver canal y todos los videos de ${video.channelTitle}` : undefined}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2848F0]/10 text-[#2848F0] dark:bg-rose-500/20 dark:text-rose-400 font-bold text-sm group-hover:scale-105 transition-transform">
              <User className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-[#121111] dark:text-slate-100 block group-hover:text-[#2848F0] dark:group-hover:text-rose-400 transition-colors">
                {fullMetadata?.channelTitle || video.channelTitle}
              </span>
              <span className="text-xs text-[#5B5B66] dark:text-slate-400 flex items-center gap-1">
                <span>Canal de YouTube</span>
                {onOpenChannel && <span className="text-[11px] text-[#2848F0] dark:text-rose-400 font-semibold">· Ver perfil</span>}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#5B5B66] dark:text-slate-400">
            {(fullMetadata?.viewCount || video.viewCountText) && (
              <span className="flex items-center gap-1.5 font-medium text-[#121111] dark:text-slate-200">
                <Eye className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-400" />
                <span>
                  {video.viewCountText || `${fullMetadata?.viewCount} visitas`}
                </span>
              </span>
            )}

            {(video.durationText || fullMetadata?.duration) && (
              <span className="flex items-center gap-1.5 font-medium text-[#121111] dark:text-slate-200">
                <Clock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{video.durationText || fullMetadata?.duration}</span>
              </span>
            )}

            {(fullMetadata?.publishedAt || video.publishedAt) && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{video.publishedAt || fullMetadata?.publishedAt}</span>
              </span>
            )}

            <button
              type="button"
              onClick={handleCopyVideoLink}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-sans font-semibold transition-all shadow-2xs cursor-pointer ${
                copiedVideoLink
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50 hover:border-[#2848F0] text-[#121111] hover:text-[#2848F0] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-rose-500 dark:hover:text-rose-400'
              }`}
              title="Copiar enlace de este video al portapapeles"
            >
              {copiedVideoLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                  <span>Copiar enlace</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4. ETIQUETAS O TAGS DEBAJO DEL VIDEO (ANTES DE LA DESCRIPCIÓN) */}
        {displayTags.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-2xl bg-[#FAFAFA] dark:bg-slate-900/50 border border-neutral-200/90 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-[#121111] dark:text-slate-200 flex items-center gap-1.5 mr-1 shrink-0 font-heading">
                <Tag className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-400" />
                <span>Etiquetas:</span>
              </span>
              {displayTags.map((t, idx) => (
                <span
                  key={`${t}-${idx}`}
                  className="rounded-lg bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-medium text-[#121111] dark:text-slate-200 shadow-2xs"
                >
                  #{t}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopyTags}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-700 dark:bg-slate-800 text-[11px] font-semibold text-[#5B5B66] hover:text-[#121111] dark:text-slate-300 dark:hover:text-white shrink-0 self-start sm:self-auto cursor-pointer transition-colors shadow-2xs"
            >
              {copiedTags ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              <span>{copiedTags ? 'Copiadas' : 'Copiar etiquetas'}</span>
            </button>
          </div>
        )}

        {/* 5. DESCRIPCIÓN DEL VIDEO ORIGINAL (DESPUÉS DE LAS ETIQUETAS, CON MOSTRAR MÁS TOTALMENTE FUNCIONAL) */}
        <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 space-y-3 dark:border-slate-800 dark:bg-slate-900/60 shadow-xs relative">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#121111] dark:text-slate-200 font-heading">
                Descripción del video
              </span>
              {isLoadingMetadata && (
                <span className="inline-flex items-center gap-1 text-[10px] text-[#5B5B66] dark:text-slate-400">
                  <Loader2 className="h-2.5 w-2.5 animate-spin text-[#2848F0]" />
                  <span>Obteniendo texto completo...</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsDescExpanded(!isDescExpanded)}
              className="flex items-center gap-1 text-xs font-bold text-[#2848F0] dark:text-rose-400 hover:underline cursor-pointer transition-colors"
            >
              <span>{isDescExpanded ? 'Mostrar menos' : 'Mostrar más'}</span>
              {isDescExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Contenedor del texto con formato y enlaces activos */}
          <div className="relative">
            <div
              className={`transition-all duration-300 ease-in-out ${
                isDescExpanded
                  ? 'max-h-none overflow-visible'
                  : 'max-h-24 overflow-hidden'
              }`}
            >
              {renderFormattedDescription(descriptionText)}
            </div>

            {/* Máscara de desvanecimiento suave cuando está colapsado */}
            {!isDescExpanded && (
              <div
                onClick={() => setIsDescExpanded(true)}
                className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white dark:from-slate-900 via-white/80 dark:via-slate-900/80 to-transparent flex items-end justify-center pb-0.5 cursor-pointer"
              >
                <span className="text-[11px] font-semibold text-[#2848F0] dark:text-rose-400 hover:underline">
                  ... Mostrar descripción completa
                </span>
              </div>
            )}
          </div>
        </div>

        {/* DETECTOR DE PROBLEMAS URGENTES PAU (IA) - DEBAJO DE LA DESCRIPCIÓN Y ARRIBA DE COMENTARIOS */}
        <div className="rounded-2xl border-2 border-[#2848F0]/30 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-5 dark:border-blue-700/50 dark:bg-gradient-to-r dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-slate-900 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#2848F0] text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-[#121111] dark:text-white font-heading">
                Detector de Problemas Urgentes PAU (IA)
              </h3>
              <span className="rounded-full bg-blue-100 dark:bg-blue-950 px-2.5 py-0.5 text-[10px] font-bold text-[#2848F0] dark:text-blue-300">
                {AVAILABLE_GEMINI_MODELS.find((m) => m.id === selectedGeminiModel)?.shortName || 'Gemini'}
              </span>
            </div>
            <p className="text-xs text-[#5B5B66] dark:text-slate-300 leading-relaxed">
              Analiza los comentarios de este video para detectar el Avatar, problema urgente, emoción raíz, miedos, deseos, citas textuales y oportunidades PAU ($5 - $47 USD).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Desplegable de Modelos Disponibles */}
            <div className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950 shadow-2xs">
              <Cpu className="h-3.5 w-3.5 text-[#2848F0] dark:text-blue-400 shrink-0" />
              <span className="text-[11px] font-semibold text-[#5B5B66] dark:text-slate-400">Modelo:</span>
              <select
                value={selectedGeminiModel}
                onChange={(e) => handleSelectModel(e.target.value as AvailableGeminiModelId)}
                disabled={isAnalyzingPau}
                className="bg-transparent text-xs font-semibold text-[#121111] dark:text-white focus:outline-none cursor-pointer pr-1"
              >
                {AVAILABLE_GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="dark:bg-slate-900 dark:text-white">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de cantidad: 100, 300, 500, 1000 o Todos */}
            <div className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950 shadow-2xs">
              <span className="text-[11px] font-semibold text-[#5B5B66] dark:text-slate-400 px-2">
                Cantidad:
              </span>
              {([100, 300, 500, 1000, 'all'] as const).map((qty) => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setPauLimit(qty)}
                  disabled={isAnalyzingPau}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    pauLimit === qty
                      ? 'bg-[#1C1C1C] text-white shadow-2xs dark:bg-slate-800'
                      : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {qty === 'all' ? 'Todos' : qty}
                </button>
              ))}
            </div>

            {/* Botón Ver análisis PAU guardado si existe */}
            {pauResult && (
              <button
                type="button"
                onClick={() => setIsViewingPauResults(true)}
                disabled={isAnalyzingPau}
                className="flex items-center gap-1.5 rounded-xl border border-[#2848F0]/30 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-[#2848F0] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Ver análisis PAU</span>
              </button>
            )}

            {/* Botón Principal Analizar con IA */}
            <button
              type="button"
              onClick={handleRequestPauAnalysis}
              disabled={isAnalyzingPau}
              className="flex items-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] text-white px-4.5 py-2 text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-60"
            >
              {isAnalyzingPau ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Analizando con Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>✨ Analizar comentarios con IA</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Banner de error de análisis si ocurrió */}
        {pauError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900/50 dark:bg-rose-950/30 flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-rose-900 dark:text-rose-200 font-heading">
                  No se pudo completar el análisis con IA
                </h4>
                <p className="text-xs text-rose-800/90 dark:text-rose-300/80 leading-relaxed">
                  {pauError}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRunPauAnalysis}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-1.5 text-xs font-semibold transition-colors shrink-0 shadow-2xs"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* 6. SECCIÓN DE COMENTARIOS Y AUDIENCIA (FINALMENTE DEBAJO DE LA DESCRIPCIÓN) */}
        <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 sm:p-6 space-y-4 dark:border-slate-800 dark:bg-slate-900/60 shadow-xs">
          {/* Header de la sección de comentarios */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#2848F0] dark:text-rose-400" />
                <h3 className="text-sm font-bold text-[#121111] dark:text-slate-100 font-heading">
                  Comentarios y Respuestas ({comments.length})
                </h3>
              </div>

              {/* Desplegable para ordenar comentarios */}
              <div className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-[#FAFAFA] px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950 shadow-2xs">
                <ArrowUpDown className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-400 shrink-0" />
                <label
                  htmlFor="watch-comments-sort"
                  className="text-[11px] font-semibold text-[#5B5B66] dark:text-slate-400 whitespace-nowrap"
                >
                  Ordenar por:
                </label>
                <select
                  id="watch-comments-sort"
                  value={commentSort}
                  onChange={(e) => setCommentSort(e.target.value as 'top' | 'newest' | 'oldest')}
                  disabled={isLoadingComments || commentsDisabled}
                  className="bg-transparent text-xs font-semibold text-[#121111] dark:text-white focus:outline-none cursor-pointer pr-1 disabled:opacity-50"
                >
                  <option value="top" className="dark:bg-slate-900 dark:text-white">
                    Principales (Destacados)
                  </option>
                  <option value="newest" className="dark:bg-slate-900 dark:text-white">
                    Más recientes
                  </option>
                  <option value="oldest" className="dark:bg-slate-900 dark:text-white">
                    Más antiguos
                  </option>
                </select>
              </div>
            </div>

            {/* Barra de herramientas para selección y descarga */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Checkbox para seleccionar todos */}
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-medium text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                {isAllSelected ? (
                  <CheckSquare className="h-4 w-4 text-[#2848F0] dark:text-rose-500" />
                ) : (
                  <Square className="h-4 w-4 text-neutral-400" />
                )}
                <span>
                  {isAllSelected
                    ? 'Deseleccionar todos'
                    : `Seleccionar todos (${selectedCommentIds.size})`}
                </span>
              </button>

              {/* Botón con Menú de Descarga (TXT, CSV, JSON) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                  disabled={selectedCommentIds.size === 0}
                  className="flex items-center gap-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 px-3.5 py-1.5 text-xs font-bold shadow-xs transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Descargar comentarios ({selectedCommentIds.size})</span>
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </button>

                {/* Dropdown de Formatos */}
                {isDownloadMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 shadow-xl p-2 z-20 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-[#5B5B66] dark:text-slate-400 uppercase">
                      Selecciona Formato
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownload('txt')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#121111] dark:text-slate-200 hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                    >
                      <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                      <div>
                        <span className="block leading-tight">Documento TXT</span>
                        <span className="text-[10px] text-[#5B5B66] dark:text-slate-400 font-normal">
                          Incluye hilos y respuestas
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload('csv')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#121111] dark:text-slate-200 hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div>
                        <span className="block leading-tight">Archivo CSV (Excel)</span>
                        <span className="text-[10px] text-[#5B5B66] dark:text-slate-400 font-normal">
                          Filas de comentarios y respuestas
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload('json')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#121111] dark:text-slate-200 hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                    >
                      <FileCode className="h-4 w-4 text-purple-500 shrink-0" />
                      <div>
                        <span className="block leading-tight">Datos JSON Estructurados</span>
                        <span className="text-[10px] text-[#5B5B66] dark:text-slate-400 font-normal">
                          Objetos anidados con replies
                        </span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mensaje de confirmación de descarga */}
          {downloadSuccessMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
              <Check className="h-4 w-4 shrink-0" />
              <span>{downloadSuccessMessage}</span>
            </div>
          )}

          {/* Estado de carga */}
          {isLoadingComments && (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-[#2848F0] dark:text-rose-500" />
              <p className="text-xs text-[#5B5B66] dark:text-slate-400">
                Obteniendo comentarios y respuestas...
              </p>
            </div>
          )}

          {/* LISTA DE COMENTARIOS CON SUS RESPUESTAS ANIDADAS */}
          {!isLoadingComments && comments.length > 0 && (
            <div className="space-y-4 divide-y divide-neutral-100 dark:divide-slate-800/80">
              {comments.map((comment) => {
                const isSelected = selectedCommentIds.has(comment.id);
                const hasReplies = comment.replies && comment.replies.length > 0;
                const replyCount = comment.replyCount || comment.replies?.length || 0;
                const isRepliesExpanded = expandedReplyThreads.has(comment.id);

                return (
                  <div
                    key={comment.id}
                    className={`pt-4 first:pt-0 rounded-xl transition-all ${
                      isSelected ? 'bg-[#FAFAFA]/70 dark:bg-slate-800/30 p-2' : ''
                    }`}
                  >
                    {/* Comentario Principal */}
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelectComment(comment.id, e)}
                        className="pt-0.5 shrink-0 text-left cursor-pointer"
                        title={isSelected ? 'Deseleccionar' : 'Seleccionar'}
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-[#2848F0] dark:text-rose-500" />
                        ) : (
                          <Square className="h-4 w-4 text-neutral-300 dark:text-slate-600" />
                        )}
                      </button>

                      {/* Avatar */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-slate-800 text-[#5B5B66] dark:text-slate-300 font-bold text-xs uppercase overflow-hidden">
                        {comment.authorProfileImageUrl ? (
                          <img
                            src={comment.authorProfileImageUrl}
                            alt={comment.authorName}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          comment.authorName.slice(0, 1)
                        )}
                      </div>

                      {/* Contenido */}
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#121111] dark:text-slate-100 truncate">
                            {comment.authorName}
                          </span>
                          <span className="text-[10px] text-[#5B5B66] dark:text-slate-400 font-mono">
                            {comment.publishedAt}
                          </span>
                        </div>

                        <p className="text-xs text-[#5B5B66] dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {comment.text}
                        </p>

                        <div className="flex items-center gap-4 text-[11px] text-[#5B5B66] dark:text-slate-400 pt-1">
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <ThumbsUp className="h-3 w-3 text-neutral-400" />
                            <span>{comment.likeCount}</span>
                          </span>

                          {/* BOTÓN PARA EXPANDIR RESPUESTAS */}
                          {replyCount > 0 && (
                            <button
                              type="button"
                              onClick={(e) => handleToggleReplies(comment.id, e)}
                              className="flex items-center gap-1 text-xs font-bold text-[#2848F0] dark:text-rose-400 hover:underline cursor-pointer"
                            >
                              <CornerDownRight className="h-3 w-3" />
                              <span>
                                {isRepliesExpanded
                                  ? 'Ocultar respuestas'
                                  : `Ver ${replyCount} ${replyCount === 1 ? 'respuesta' : 'respuestas'}`}
                              </span>
                              {isRepliesExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SECCIÓN DE RESPUESTAS ANIDADAS (SI ESTÁ EXPANDIDO) */}
                    {isRepliesExpanded && hasReplies && (
                      <div className="mt-3 ml-8 sm:ml-11 pl-3 border-l-2 border-neutral-200 dark:border-slate-700 space-y-3 pt-1">
                        {comment.replies!.map((reply) => (
                          <div key={reply.id} className="flex items-start gap-2.5 pt-1.5">
                            {/* Avatar de la respuesta */}
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-slate-800 text-[#5B5B66] dark:text-slate-300 font-bold text-[10px] uppercase overflow-hidden">
                              {reply.authorProfileImageUrl ? (
                                <img
                                  src={reply.authorProfileImageUrl}
                                  alt={reply.authorName}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                reply.authorName.slice(0, 1)
                              )}
                            </div>

                            {/* Contenido de la respuesta */}
                            <div className="flex-1 space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-[#121111] dark:text-slate-200 truncate">
                                  {reply.authorName}
                                </span>
                                <span className="text-[9px] text-[#5B5B66] dark:text-slate-400 font-mono">
                                  {reply.publishedAt}
                                </span>
                              </div>

                              <p className="text-[11px] text-[#5B5B66] dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {reply.text}
                              </p>

                              <div className="flex items-center gap-1.5 text-[10px] text-[#5B5B66] dark:text-slate-400 pt-0.5">
                                <ThumbsUp className="h-2.5 w-2.5 text-neutral-400" />
                                <span className="font-mono text-[9px]">{reply.likeCount}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!isLoadingComments && comments.length === 0 && (
            <div className="py-8 text-center text-xs text-[#5B5B66] dark:text-slate-400">
              {commentsDisabled
                ? 'Los comentarios están desactivados por el creador en este video.'
                : commentsError
                ? commentsError
                : 'Este video aún no tiene comentarios publicados.'}
            </div>
          )}
        </div>
      </div>

      {/* Modal para Añadir a Lista de Reproducción */}
      {isPlaylistModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                  <ListPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#121111] dark:text-white font-heading">
                    Añadir a Lista de Reproducción
                  </h3>
                  <p className="text-[11px] text-[#5B5B66] dark:text-slate-400">
                    Reproduce en bucle o de forma continua
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPlaylistModalOpen(false)}
                className="rounded-lg p-1 text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Listas existentes */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#121111] dark:text-slate-300 font-heading">
                Selecciona una lista existente:
              </label>

              {userPlaylists.length === 0 ? (
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-slate-800/50 text-center text-xs text-[#5B5B66] dark:text-slate-400">
                  No tienes listas creadas aún. Crea la primera abajo:
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {userPlaylists.map((pl) => {
                    const alreadyIn = pl.items.some((i) => i.id === video.id);
                    return (
                      <div
                        key={pl.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200/80 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-800/40 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: pl.color || '#2848F0' }}
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-[#121111] dark:text-slate-100 block truncate">
                              {pl.name}
                            </span>
                            <span className="text-[10px] text-[#5B5B66] dark:text-slate-400 font-mono">
                              {pl.items.length} {pl.items.length === 1 ? 'video' : 'videos'}
                            </span>
                          </div>
                        </div>

                        {alreadyIn ? (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" />
                            <span>Agregado</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddToPlaylist(pl.id)}
                            className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-2xs cursor-pointer transition-colors"
                          >
                            Añadir
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Crear nueva lista directa */}
            <div className="border-t border-neutral-100 pt-3 dark:border-slate-800">
              {!isCreatingNewPlaylist ? (
                <button
                  type="button"
                  onClick={() => setIsCreatingNewPlaylist(true)}
                  className="w-full py-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-300 hover:border-indigo-500 text-xs font-bold text-[#5B5B66] hover:text-indigo-600 dark:border-slate-700 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Crear nueva lista para este video</span>
                </button>
              ) : (
                <form onSubmit={handleCreateAndAdd} className="space-y-3">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    placeholder="Nombre de la nueva lista (ej. Música para programar)"
                    autoFocus
                    className="w-full rounded-xl border border-neutral-200 bg-white p-2.5 text-xs text-[#121111] placeholder-[#5B5B66]/60 focus:border-indigo-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewPlaylist(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#5B5B66] hover:bg-neutral-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!newPlaylistName.trim()}
                      className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                    >
                      Crear y Añadir
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Flotante PAU */}
      {pauToastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-[#1C1C1C] dark:bg-slate-800 text-white px-4 py-3 text-xs font-semibold shadow-xl border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{pauToastMessage}</span>
        </div>
      )}

      {/* Modal Seguro de Confirmación Previo al Análisis */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#2848F0] dark:bg-blue-950/70 dark:text-blue-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h4 className="text-sm font-bold text-[#121111] dark:text-white font-heading">
                  ¿Confirmar análisis de comentarios con IA?
                </h4>
                <p className="text-xs text-[#5B5B66] dark:text-slate-300 leading-relaxed">
                  Estás a punto de enviar comentarios a Gemini con el modelo{' '}
                  <strong className="text-[#121111] dark:text-white font-semibold">
                    {AVAILABLE_GEMINI_MODELS.find((m) => m.id === selectedGeminiModel)?.name || selectedGeminiModel}
                  </strong>.
                </p>

                <div className="rounded-xl border border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/60 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[#5B5B66] dark:text-slate-400">
                    <span>Cantidad seleccionada:</span>
                    <strong className="text-[#121111] dark:text-white font-mono">
                      {pauLimit === 'all' ? 'Todos los comentarios disponibles' : `Primeros ${pauLimit} comentarios`}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between text-[#5B5B66] dark:text-slate-400">
                    <span>Filtros aplicados:</span>
                    <span className="text-[#121111] dark:text-slate-300">Limpieza de spam, links y duplicados</span>
                  </div>
                </div>

                {previousAnalysisInfo && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <p className="leading-relaxed">
                      Ya realizaste un análisis previo de este video el <strong>{previousAnalysisInfo.dateText}</strong>. ¿Deseas volver a hacerlo? Al confirmar, se guardará como un nuevo registro fechado en <strong>Salidas prompt</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRunPauAnalysis}
                className="rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] text-white px-5 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Confirmar y Analizar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pop-up Post-Análisis: Ver ahora o Ver después */}
      {showPostAnalysisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-950 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/70 dark:text-emerald-400 shadow-xs">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <div className="space-y-1.5">
              <h4 className="text-base font-bold text-[#121111] dark:text-white font-heading">
                ¡Análisis de comentarios realizado con éxito!
              </h4>
              <p className="text-xs text-[#5B5B66] dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
                El Detector PAU ha estructurado el avatar del cliente ideal, los dolores reales y las oportunidades comerciales para este video. El resultado ya quedó guardado en tu base de datos local.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3 border-t border-neutral-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowPostAnalysisModal(false);
                  showPauToast('Análisis guardado en Salidas prompt para consultar cuando desees');
                }}
                className="w-full sm:w-auto rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-50 hover:text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Ver después
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPostAnalysisModal(false);
                  setIsViewingPauResults(true);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] text-white px-5 py-2.5 text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Ver ahora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dedicado del Detector PAU con Gemini (Fallback) */}
      <PauDetectorModal
        isOpen={isPauModalOpen}
        onClose={() => setIsPauModalOpen(false)}
        result={pauResult}
        onRetry={handleRequestPauAnalysis}
        videoTitle={fullMetadata?.title || video.title}
        videoId={video.id}
      />
    </div>
  );
}
