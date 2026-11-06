'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  Download,
  Copy,
  Check,
  ThumbsUp,
  MessageCircle,
  FileSpreadsheet,
  FileText,
  Key,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  CornerDownRight,
  Filter,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Eye,
  Cpu,
} from 'lucide-react';
import {
  YouTubeVideoMetadata,
  VideoCommentsData,
  YouTubeCommentItem,
  YouTubeCommentReply,
  PauAnalysisResult,
  PauCommentsLimit,
  PromptExecutionRecord,
} from '@/lib/types';
import { formatDateSafe } from '@/lib/youtube';
import { getContentRepository } from '@/lib/repository';
import { PauDetectorModal } from './PauDetectorModal';
import { PauContinuousView } from './PauContinuousView';
import { AVAILABLE_GEMINI_MODELS, AvailableGeminiModelId } from '@/lib/pau-prompt';

interface CommentsTabProps {
  metadata: YouTubeVideoMetadata;
  commentsData: VideoCommentsData | null;
  isLoading: boolean;
  onFetchComments: () => Promise<void>;
  onOpenSettings: () => void;
  hasApiKey: boolean;
}

export function CommentsTab({
  metadata,
  commentsData,
  isLoading,
  onFetchComments,
  onOpenSettings,
  hasApiKey,
}: CommentsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'likes' | 'recent'>('relevance');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Estado de selección individual y por lotes (Set de IDs)
  const [selectedCommentIds, setSelectedCommentIds] = useState<Set<string>>(new Set());

  // Hilos de respuestas desplegados (Set de IDs de comentarios principales)
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Set<string>>(new Set());

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

  // Estados de Confirmación y Decisión Post-Análisis
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
    if (metadata.videoId && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`pau_analysis_${metadata.videoId}`);
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
  const [prevVideoIdForPau, setPrevVideoIdForPau] = useState(metadata.videoId);
  if (metadata.videoId !== prevVideoIdForPau) {
    setPrevVideoIdForPau(metadata.videoId);
    let loaded: PauAnalysisResult | null = null;
    if (metadata.videoId && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`pau_analysis_${metadata.videoId}`);
      if (stored) {
        try {
          loaded = JSON.parse(stored);
        } catch {}
      }
    }
    setPauResult(loaded);
    setIsViewingPauResults(false);
  }

  // Comprobar análisis previo y abrir modal de confirmación
  const handleRequestPauAnalysis = async () => {
    try {
      const repo = getContentRepository();
      const prev = await repo.getPromptOutputsByVideo(metadata.videoId);
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

  // Validar estrictamente que los comentarios pertenezcan al video actual
  const isCurrentVideoComments = commentsData?.videoId === metadata.videoId;
  const commentsList: YouTubeCommentItem[] = useMemo(() => {
    if (!isCurrentVideoComments || !commentsData?.comments) return [];
    return commentsData.comments;
  }, [isCurrentVideoComments, commentsData]);

  // Seleccionar automáticamente todos los comentarios al cargarse (sin límite de 100)
  const [prevCommentsCount, setPrevCommentsCount] = useState<number>(0);
  if (commentsList.length !== prevCommentsCount) {
    setPrevCommentsCount(commentsList.length);
    setSelectedCommentIds(new Set(commentsList.map((c) => c.id)));
  }

  // Filtrado y ordenamiento de comentarios
  const filteredComments = useMemo(() => {
    let result = [...commentsList];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.text.toLowerCase().includes(q) ||
          c.authorName.toLowerCase().includes(q) ||
          c.replies?.some(
            (r) =>
              r.text.toLowerCase().includes(q) ||
              r.authorName.toLowerCase().includes(q)
          )
      );
    }

    if (sortBy === 'likes') {
      result.sort((a, b) => b.likeCount - a.likeCount);
    } else if (sortBy === 'recent') {
      result.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
    }

    return result;
  }, [commentsList, searchQuery, sortBy]);

  // Manejo de checkboxes
  const toggleSelectComment = (id: string) => {
    setSelectedCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected =
    filteredComments.length > 0 &&
    filteredComments.every((c) => selectedCommentIds.has(c.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCommentIds(new Set());
    } else {
      const allIds = new Set(filteredComments.map((c) => c.id));
      setSelectedCommentIds(allIds);
    }
  };

  // Toggle para expandir/colapsar respuestas
  const toggleExpandReplies = (commentId: string) => {
    setExpandedReplyThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const handleCopyComment = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Obtener los comentarios a exportar (seleccionados o todos)
  const getCommentsForExport = (): YouTubeCommentItem[] => {
    if (selectedCommentIds.size > 0) {
      return commentsList.filter((c) => selectedCommentIds.has(c.id));
    }
    return commentsList;
  };

  const handleDownloadCsv = () => {
    const listToExport = getCommentsForExport();
    if (listToExport.length === 0) return;

    const headers = ['Tipo', 'ID', 'Autor', 'Fecha', 'Me Gusta', 'Respuestas', 'Texto'];
    const rows: string[] = [];

    listToExport.forEach((c) => {
      rows.push(
        [
          '"Comentario"',
          `"${c.id}"`,
          `"${c.authorName.replace(/"/g, '""')}"`,
          `"${new Date(c.publishedAt).toLocaleString('es-ES')}"`,
          c.likeCount,
          c.replyCount || 0,
          `"${c.text.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`,
        ].join(',')
      );

      // Si tiene respuestas, incluirlas ordenadas
      if (c.replies && c.replies.length > 0) {
        c.replies.forEach((r) => {
          rows.push(
            [
              '"Respuesta"',
              `"${r.id}"`,
              `"${r.authorName.replace(/"/g, '""')}"`,
              `"${new Date(r.publishedAt).toLocaleString('es-ES')}"`,
              r.likeCount,
              0,
              `"${r.text.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`,
            ].join(',')
          );
        });
      }
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comentarios-${metadata.videoId}${selectedCommentIds.size > 0 ? '-seleccionados' : ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const listToExport = getCommentsForExport();
    if (listToExport.length === 0) return;
    const blob = new Blob([JSON.stringify(listToExport, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comentarios-${metadata.videoId}${selectedCommentIds.size > 0 ? '-seleccionados' : ''}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadTxt = () => {
    const listToExport = getCommentsForExport();
    if (listToExport.length === 0) return;
    const textContent = listToExport
      .map((c, idx) => {
        let block = `[${idx + 1}] ${c.authorName} (${new Date(c.publishedAt).toLocaleDateString('es-ES')}) — ${c.likeCount} likes:\n${c.text}\n`;
        if (c.replies && c.replies.length > 0) {
          block += `\n   Respuestas (${c.replies.length}):\n`;
          c.replies.forEach((r, rIdx) => {
            block += `   [${rIdx + 1}] ${r.authorName} (${new Date(r.publishedAt).toLocaleDateString('es-ES')}): ${r.text}\n`;
          });
        }
        return block;
      })
      .join('\n----------------------------------------\n\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comentarios-${metadata.videoId}${selectedCommentIds.size > 0 ? '-seleccionados' : ''}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRunPauAnalysis = async () => {
    if (commentsList.length === 0) return;
    setIsConfirmModalOpen(false);
    setIsAnalyzingPau(true);
    setPauError(null);

    try {
      let customPrompt: string | undefined = undefined;
      if (typeof window !== 'undefined') {
        const storedPrompt = localStorage.getItem('pau_detector_prompt');
        if (storedPrompt && storedPrompt.trim().length > 50) {
          customPrompt = storedPrompt;
        }
      }

      const payload = {
        comments: commentsList.map((c) => ({
          id: c.id,
          text: c.text,
          authorName: c.authorName,
          likeCount: c.likeCount,
        })),
        customPrompt,
        limit: pauLimit,
        selectedModel: selectedGeminiModel,
        videoTitle: metadata.title,
        videoId: metadata.videoId,
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
        localStorage.setItem(`pau_analysis_${metadata.videoId}`, JSON.stringify(data.data));
      }

      // Guardar el registro en IndexedDB (Salidas prompt)
      try {
        const record: PromptExecutionRecord = {
          id: `output-${Date.now()}`,
          promptId: 'prompt-pau-default',
          promptName: 'Detector de Problemas Urgentes PAU',
          videoId: metadata.videoId,
          videoTitle: metadata.title,
          channelTitle: metadata.channelTitle,
          thumbnailUrl: metadata.thumbnails?.mq?.url || metadata.thumbnails?.default?.url,
          modelUsed: data.modelUsed || selectedGeminiModel,
          commentsCount: data.data.meta?.comentarios_analizados || commentsList.length,
          commentsSelectedQty: pauLimit,
          result: data.data,
          createdAt: Date.now(),
        };
        await getContentRepository().savePromptOutput(record);
      } catch (saveErr) {
        console.warn('Error saving prompt output in comments tab:', saveErr);
      }

      setShowPostAnalysisModal(true);
    } catch (err: any) {
      console.error('Error al analizar PAU:', err);
      setPauError(err.message || 'Error inesperado al conectar con Gemini.');
    } finally {
      setIsAnalyzingPau(false);
    }
  };

  if (isViewingPauResults && pauResult) {
    return (
      <div className="space-y-6">
        <PauContinuousView
          result={pauResult}
          videoTitle={metadata.title}
          videoId={metadata.videoId}
          onBack={() => setIsViewingPauResults(false)}
          backButtonText="Volver a los comentarios del video"
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#2848F0] dark:text-rose-500" />
        <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
          Descargando comentarios oficiales y respuestas de YouTube...
        </h3>
        <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md">
          Sincronizando los hilos de comentarios, respuestas anidadas y conteos de me gusta para el video actual.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-neutral-200/80 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#121111] dark:text-slate-100 font-heading">
              Comentarios del Video
            </h2>
            {commentsList.length > 0 && (
              <span className="text-xs font-mono font-medium text-[#5B5B66] dark:text-slate-400 tabular-nums">
                ({commentsList.length} cargados)
              </span>
            )}
          </div>
          <p className="text-xs text-[#5B5B66] dark:text-slate-400 mt-0.5">
            Selecciona con casillas los comentarios deseados, visualiza hilos de respuestas y exporta en CSV, JSON o TXT.
          </p>
        </div>

        {/* Botones de acción y descarga */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onFetchComments}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-[#121111] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{commentsList.length > 0 ? 'Actualizar' : 'Cargar Comentarios'}</span>
          </button>

          {commentsList.length > 0 && (
            <>
              <button
                onClick={handleDownloadCsv}
                className="flex items-center gap-1.5 rounded-xl bg-[#1C1C1C] hover:bg-[#2E2E2E] dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 px-3.5 py-2 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                title={
                  selectedCommentIds.size > 0
                    ? `Descargar ${selectedCommentIds.size} comentarios seleccionados en CSV`
                    : 'Descargar todos los comentarios en CSV'
                }
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>
                  Descargar CSV {selectedCommentIds.size > 0 ? `(${selectedCommentIds.size})` : ''}
                </span>
              </button>

              <button
                onClick={handleDownloadJson}
                className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-[#5B5B66] dark:text-slate-300 hover:text-[#121111] hover:bg-[#FAFAFA] dark:hover:text-white transition-colors shadow-2xs cursor-pointer"
                title={
                  selectedCommentIds.size > 0
                    ? `Descargar ${selectedCommentIds.size} comentarios en JSON`
                    : 'Descargar JSON completo'
                }
              >
                <Download className="h-3.5 w-3.5" />
                <span>.JSON {selectedCommentIds.size > 0 ? `(${selectedCommentIds.size})` : ''}</span>
              </button>

              <button
                onClick={handleDownloadTxt}
                className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-2.5 py-2 text-xs font-semibold text-[#5B5B66] dark:text-slate-300 hover:text-[#121111] hover:bg-[#FAFAFA] dark:hover:text-white transition-colors shadow-2xs cursor-pointer"
                title="Descargar archivo .txt"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>.TXT</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Aviso de API Key si no está configurada */}
      {!hasApiKey && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4.5 dark:border-amber-900/40 dark:bg-amber-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <Key className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 font-heading">
                Clave de YouTube Data API v3 para comentarios y respuestas
              </h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-400/80 leading-relaxed">
                Para descargar comentarios oficiales y todas sus respuestas anidadas, ingresa tu clave gratuita en Configuración.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            className="rounded-xl bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors shadow-2xs cursor-pointer"
          >
            Abrir Configuración
          </button>
        </div>
      )}

      {/* Estado vacío antes de cargar los comentarios del video actual */}
      {commentsList.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/30 p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-[#5B5B66] dark:text-slate-400 shadow-2xs border border-neutral-200 dark:border-slate-800">
            <MessageSquare className="h-6 w-6 text-[#2848F0] dark:text-rose-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
              Descargar comentarios de &quot;{metadata.title}&quot;
            </h3>
            <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md mx-auto">
              Haz clic en el botón para consultar y extraer los comentarios y respuestas reales de este video.
            </p>
          </div>
          <button
            onClick={onFetchComments}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Descargar Comentarios del Video</span>
          </button>
        </div>
      ) : (
        <>
          {/* Banner de Análisis con IA - Detector de Problemas Urgentes PAU */}
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
                Analiza los comentarios limpios para extraer el Avatar, problema urgente, emoción raíz, miedos, deseos, citas textuales y oportunidades PAU ($5 - $47 USD).
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

              {/* Botón Ver guardado si existe */}
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

          {/* Barra de selección por lotes y filtros */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/80 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Lado izquierdo: Seleccionar todos y contador */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-slate-700 bg-[#FAFAFA] dark:bg-slate-800 text-xs font-semibold text-[#121111] dark:text-slate-200 hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                {isAllSelected ? (
                  <CheckSquare className="h-4 w-4 text-[#2848F0] dark:text-rose-400" />
                ) : (
                  <Square className="h-4 w-4 text-[#5B5B66] dark:text-slate-400" />
                )}
                <span>{isAllSelected ? 'Deseleccionar todos' : `Seleccionar todos (${filteredComments.length})`}</span>
              </button>

              <span className="text-xs text-[#5B5B66] dark:text-slate-400 font-mono">
                <strong className="text-[#121111] dark:text-white">{selectedCommentIds.size}</strong>{' '}
                seleccionados de {filteredComments.length}
              </span>

              {selectedCommentIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCommentIds(new Set())}
                  className="text-xs text-rose-600 hover:underline dark:text-rose-400 font-medium cursor-pointer"
                >
                  Limpiar selección
                </button>
              )}
            </div>

            {/* Lado derecho: Buscador de texto y orden */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="relative w-full sm:w-64">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#5B5B66] dark:text-slate-500">
                  <Search className="h-3.5 w-3.5" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar comentario o autor..."
                  className="w-full rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900 py-1.5 pl-9 pr-3 text-xs text-[#121111] dark:text-slate-200 placeholder-[#5B5B66]/70 focus:border-[#2848F0] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 bg-[#F5F5F5] dark:bg-slate-950 p-1 rounded-xl border border-neutral-200/60 dark:border-slate-800 self-start sm:self-auto">
                <button
                  onClick={() => setSortBy('relevance')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    sortBy === 'relevance'
                      ? 'bg-white text-[#121111] shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400'
                  }`}
                >
                  Relevancia
                </button>
                <button
                  onClick={() => setSortBy('likes')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    sortBy === 'likes'
                      ? 'bg-white text-[#121111] shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400'
                  }`}
                >
                  Me Gusta
                </button>
                <button
                  onClick={() => setSortBy('recent')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    sortBy === 'recent'
                      ? 'bg-white text-[#121111] shadow-xs dark:bg-slate-800 dark:text-white'
                      : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400'
                  }`}
                >
                  Recientes
                </button>
              </div>
            </div>
          </div>

          {/* Listado de comentarios con selección y respuestas anidadas */}
          <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
            {filteredComments.length > 0 ? (
              filteredComments.map((comment) => {
                const isSelected = selectedCommentIds.has(comment.id);
                const isExpanded = expandedReplyThreads.has(comment.id);
                const hasReplies = Boolean(comment.replies && comment.replies.length > 0);
                const replyCount = comment.replyCount || comment.replies?.length || 0;

                return (
                  <div
                    key={comment.id}
                    className={`rounded-2xl border transition-all p-4 space-y-3 ${
                      isSelected
                        ? 'border-[#2848F0] bg-[#EEF1F8]/40 dark:border-rose-500/80 dark:bg-rose-950/20 shadow-xs'
                        : 'border-neutral-200/90 bg-white hover:border-neutral-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 shadow-2xs'
                    }`}
                  >
                    {/* Fila superior: Checkbox, Autor, Fecha y Copiar */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {/* Checkbox de selección a la izquierda */}
                        <button
                          type="button"
                          onClick={() => toggleSelectComment(comment.id)}
                          className="mt-1 text-[#5B5B66] hover:text-[#2848F0] dark:text-slate-400 dark:hover:text-rose-400 cursor-pointer transition-colors"
                          title={isSelected ? 'Deseleccionar comentario' : 'Seleccionar comentario'}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4.5 w-4.5 text-[#2848F0] dark:text-rose-500" />
                          ) : (
                            <Square className="h-4.5 w-4.5 text-neutral-400 dark:text-slate-600" />
                          )}
                        </button>

                        {/* Avatar y Autor */}
                        <div className="flex items-center gap-2.5">
                          {comment.authorProfileImageUrl ? (
                            <img
                              src={comment.authorProfileImageUrl}
                              alt={comment.authorName}
                              referrerPolicy="no-referrer"
                              className="h-8 w-8 rounded-full object-cover border border-neutral-200 dark:border-slate-700"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-neutral-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-[#121111] dark:text-slate-300">
                              {comment.authorName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h4 className="text-xs font-bold text-[#121111] dark:text-slate-100 font-heading">
                              {comment.authorName}
                            </h4>
                            <span className="text-[10px] text-[#5B5B66] dark:text-slate-500 font-mono">
                              {formatDateSafe(comment.publishedAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botón copiar comentario */}
                      <button
                        onClick={() => handleCopyComment(comment.text, comment.id)}
                        className="text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-white p-1 rounded-md transition-colors cursor-pointer"
                        title="Copiar texto del comentario"
                      >
                        {copiedId === comment.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Texto del comentario */}
                    <div className="pl-7">
                      <p className="text-xs text-[#121111] dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {comment.text}
                      </p>

                      {/* Metadatos inferiores: Likes y Botón de respuestas */}
                      <div className="flex items-center gap-4 pt-2.5 text-[11px] text-[#5B5B66] dark:text-slate-400">
                        <div className="flex items-center gap-1 font-mono tabular-nums">
                          <ThumbsUp className="h-3 w-3 text-[#2848F0] dark:text-rose-400" />
                          <span>{comment.likeCount} likes</span>
                        </div>

                        {replyCount > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpandReplies(comment.id)}
                            className="flex items-center gap-1 font-medium text-[#2848F0] hover:underline dark:text-rose-400 cursor-pointer"
                          >
                            <MessageCircle className="h-3 w-3" />
                            <span>
                              {isExpanded ? 'Ocultar respuestas' : `Ver ${replyCount} respuestas`}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Respuestas anidadas (hilo desplegado) */}
                      {isExpanded && (
                        <div className="mt-3.5 space-y-2.5 border-l-2 border-[#2848F0]/30 dark:border-rose-500/40 pl-3.5 py-1">
                          {comment.replies && comment.replies.length > 0 ? (
                            comment.replies.map((reply: YouTubeCommentReply) => (
                              <div
                                key={reply.id}
                                className="rounded-xl bg-[#FAFAFA] dark:bg-slate-800/40 p-2.5 space-y-1.5 border border-neutral-200/50 dark:border-slate-800"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <CornerDownRight className="h-3 w-3 text-[#2848F0] dark:text-rose-400 shrink-0" />
                                    {reply.authorProfileImageUrl ? (
                                      <img
                                        src={reply.authorProfileImageUrl}
                                        alt={reply.authorName}
                                        referrerPolicy="no-referrer"
                                        className="h-5 w-5 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="h-5 w-5 rounded-full bg-neutral-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold">
                                        {reply.authorName.slice(0, 1)}
                                      </div>
                                    )}
                                    <span className="text-[11px] font-bold text-[#121111] dark:text-slate-200">
                                      {reply.authorName}
                                    </span>
                                    <span className="text-[10px] text-[#5B5B66] dark:text-slate-500 font-mono">
                                      {formatDateSafe(reply.publishedAt)}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 text-[10px] text-[#5B5B66] dark:text-slate-400 font-mono">
                                    <ThumbsUp className="h-2.5 w-2.5" />
                                    <span>{reply.likeCount}</span>
                                  </div>
                                </div>

                                <p className="text-xs text-[#121111] dark:text-slate-200 pl-5 leading-relaxed whitespace-pre-wrap">
                                  {reply.text}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-[#5B5B66] dark:text-slate-400 italic py-1">
                              No hay respuestas directas devueltas por la API para este hilo.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-xs text-[#5B5B66] dark:text-slate-500 rounded-2xl border border-dashed border-neutral-200 dark:border-slate-800">
                No se encontraron comentarios que coincidan con &quot;{searchQuery}&quot;.
              </div>
            )}
          </div>
        </>
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
        videoTitle={metadata.title}
        videoId={metadata.videoId}
      />
    </div>
  );
}
